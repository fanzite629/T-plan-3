using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal sealed class MainWindow : Form
{
    readonly WebView2 web = new WebView2();
    readonly Database database;
    readonly string root;
    readonly Timer poll = new Timer();
    readonly JavaScriptSerializer json = new JavaScriptSerializer { MaxJsonLength = 2100000 };
    readonly AiGateway ai;
    TimerMiniWindow mini;
    CompanionWindow pet;
    bool closing, polling;
    FormWindowState restoreState = FormWindowState.Normal;

    public MainWindow(string dataRoot, Database db)
    {
        root = dataRoot; database = db; ai = new AiGateway(db);
        Text = Environment.GetEnvironmentVariable("TPLAN_V3_QA") == "1" ? "T计划 v3 · 独立验收（测试数据）" : "T计划 v3";
        Size = new Size(1280, 900); MinimumSize = new Size(800, 600);
        StartPosition = FormStartPosition.CenterScreen;
        using(var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("icon")) Icon = new Icon(s);
        web.Dock = DockStyle.Fill; Controls.Add(web);
        Shown += Initialize;
        poll.Interval = 500;
        poll.Tick += async delegate {
            if(closing || polling || web.CoreWebView2 == null) return;
            polling = true;
            try { await web.CoreWebView2.ExecuteScriptAsync("window.tplanDesktopPoll && window.tplanDesktopPoll()"); }
            catch { /* Navigation and shutdown may interrupt one poll. The next snapshot catches up. */ }
            finally { polling = false; }
        };
        Resize += delegate { if(WindowState!=FormWindowState.Minimized)restoreState=WindowState; };
        FormClosing += delegate { closing = true; poll.Stop(); if(pet!=null)pet.ShutDown(); ai.Dispose(); };
        FormClosed += delegate { poll.Dispose(); if(mini != null) mini.ShutDown(); web.Dispose(); };
    }

    async void Initialize(object sender, EventArgs args)
    {
        try {
            var options = new CoreWebView2EnvironmentOptions { Language = "zh-CN" };
            var env = await CoreWebView2Environment.CreateAsync(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime"), Path.Combine(root, "Profile"), options);
            if(closing) return;
            await web.EnsureCoreWebView2Async(env);
            if(closing) return;
            var core = web.CoreWebView2;
            core.Settings.AreHostObjectsAllowed = true;
            core.Settings.IsWebMessageEnabled = true;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.AreDevToolsEnabled = Environment.GetEnvironmentVariable("TPLAN_V3_QA") == "1";
            core.AddHostObjectToScript("database", database);
            core.NavigationStarting += delegate(object s, CoreWebView2NavigationStartingEventArgs e) {
                if(e.Uri != "https://tplan-v3.local/index.html" && !e.Uri.StartsWith("https://tplan-v3.local/index.html#")) e.Cancel = true;
            };
            core.NewWindowRequested += delegate(object s, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.PermissionRequested += delegate(object s, CoreWebView2PermissionRequestedEventArgs e) { e.State = CoreWebView2PermissionState.Deny; };
            core.AddWebResourceRequestedFilter("https://tplan-v3.local/*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object s, CoreWebView2WebResourceRequestedEventArgs e) {
                e.Response = env.CreateWebResourceResponse(Assembly.GetExecutingAssembly().GetManifestResourceStream("index"), 200, "OK", "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store");
            };
            core.DownloadStarting += delegate(object s, CoreWebView2DownloadStartingEventArgs e) {
                using(var dialog = new SaveFileDialog()) {
                    dialog.FileName = Path.GetFileName(e.ResultFilePath); dialog.Filter = "JSON 文件|*.json|所有文件|*.*";
                    if(dialog.ShowDialog(this) == DialogResult.OK) e.ResultFilePath = dialog.FileName; else e.Cancel = true;
                    e.Handled = true;
                }
            };
            core.WebMessageReceived += OnTimerMessage;
            core.NavigationCompleted += delegate {
                if(closing)return;
                poll.Start();
                if(pet==null){
                    var agent=new CompanionAgent(ai,GetCompanionContext);
                    pet=new CompanionWindow(root,Icon,agent,OpenCompanionDraft,ReturnToTimer,SendCommand);
                    pet.StateChanged+=WritePetSnapshot;
                }
                WritePetSnapshot();
            };
            core.Navigate("https://tplan-v3.local/index.html");
        } catch(Exception ex) { if(!closing) { MessageBox.Show(this, "启动失败：" + ex.Message); Close(); } }
    }

    async void OnTimerMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if(closing || !e.Source.StartsWith("https://tplan-v3.local/index.html")) return;
        Dictionary<string, object> data;
        try { data = json.Deserialize<Dictionary<string, object>>(e.WebMessageAsJson); } catch { return; }
        object raw;
        if(data == null || !data.TryGetValue("kind", out raw)) return;
        string kind = Convert.ToString(raw);
        if(kind=="pet-control"){
            string action=data.TryGetValue("action",out raw)?Convert.ToString(raw):"";
            if(pet!=null&&action.Length<32){pet.Control(action);WritePetSnapshot();}return;
        }
        if(kind == "ai-request" || kind == "ai-cancel") {
            string id=data.TryGetValue("id",out raw)?Convert.ToString(raw):"";
            if(id.Length==0 || id.Length>100)return;
            if(kind=="ai-cancel") { ai.Cancel(id);return; }
            string response=null,error=null;
            try {
                string system=data.TryGetValue("system",out raw)?Convert.ToString(raw):"";
                string user=data.TryGetValue("user",out raw)?Convert.ToString(raw):"";
                response=await ai.Request(id,system,user);
            } catch(Exception ex) { error=ex is InvalidOperationException?ex.Message:"模型响应格式异常，尚未写入任务。"; }
            if(!closing && web.CoreWebView2!=null) web.CoreWebView2.PostWebMessageAsJson(json.Serialize(new {kind="ai-response",id=id,text=response,error=error}));
            return;
        }
        if(kind != "timer-state" && kind != "timer-mini") return;
        if(Environment.GetEnvironmentVariable("TPLAN_V3_QA") == "1")
            File.WriteAllText(Path.Combine(root, "mini-message.json"), e.WebMessageAsJson);
        string phase = data.TryGetValue("phase", out raw) ? Convert.ToString(raw) : "ready";
        if(phase != "ready" && phase != "running" && phase != "paused" && phase != "due" && phase != "ended") return;
        if(mini != null) mini.UpdateSnapshot(data);
        if(pet != null){pet.UpdateSnapshot(data);WritePetSnapshot();}
        if(phase == "ready" || phase == "ended") {
            if(mini != null && mini.Visible) ReturnToTimer();
            return;
        }
        if(kind != "timer-mini") return;
        if(mini == null) {
            mini = new TimerMiniWindow(ReturnToTimer, SendCommand); mini.Icon = Icon;
            Rectangle area = Screen.FromControl(this).WorkingArea;
            mini.Location = new Point(area.Right - mini.Width - 24, area.Top + 70);
        }
        mini.UpdateSnapshot(data); mini.KeepOnScreen();
        if(WindowState != FormWindowState.Minimized) restoreState = WindowState;
        mini.Show(); WindowState = FormWindowState.Minimized; mini.Activate();
        if(Environment.GetEnvironmentVariable("TPLAN_V3_QA") == "1")
            File.WriteAllText(Path.Combine(root, "mini-window.json"), json.Serialize(new {visible=mini.Visible, topMost=mini.TopMost, bounds=mini.Bounds.ToString(), mainState=WindowState.ToString()}));
    }
    void SendCommand(string command)
    {
        if(closing || web.CoreWebView2 == null) return;
        if(command != "pause" && command != "resume" && command != "add5" && command != "end") return;
        web.CoreWebView2.PostWebMessageAsString("timer:" + command);
    }
    void ReturnToTimer()
    {
        if(closing) return;
        if(mini != null) mini.Hide();
        Show(); WindowState = restoreState; Activate();
        if(web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsString("timer:show");
    }
    System.Threading.Tasks.Task<string> GetCompanionContext(){return web.CoreWebView2.ExecuteScriptAsync("window.tplanPetContext ? window.tplanPetContext() : null");}
    async System.Threading.Tasks.Task<string> OpenCompanionDraft(Dictionary<string,object> draft,string id,string prompt)
    {
        if(closing||web.CoreWebView2==null)throw new InvalidOperationException("主界面暂不可用，请稍后重试。");
        string result=await web.CoreWebView2.ExecuteScriptAsync("window.tplanPetDraft ? window.tplanPetDraft("+json.Serialize(draft)+","+json.Serialize(id)+","+json.Serialize(prompt)+") : ({ok:false,error:'界面仍在加载'})");
        Show();WindowState=restoreState;Activate();return result;
    }
    void WritePetSnapshot(){if(pet==null||closing||Environment.GetEnvironmentVariable("TPLAN_V3_QA")!="1")return;string state=json.Serialize(pet.Snapshot());File.WriteAllText(Path.Combine(root,"pet-state.json"),state);}
}
