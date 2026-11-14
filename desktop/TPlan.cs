using System;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Web.Script.Serialization;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

[assembly: AssemblyTitle("T计划")]
[assembly: AssemblyProduct("T计划")]
[assembly: AssemblyDescription("离线个人学习控制台")]
[assembly: AssemblyVersion("1.10.0.0")]
[assembly: AssemblyFileVersion("1.10.0.0")]

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        string dataRoot = Environment.GetEnvironmentVariable("TPLAN_DATA_DIR");
        if (String.IsNullOrWhiteSpace(dataRoot))
#if TPLAN_CANDIDATE
            dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TPlanCandidate1100");
#else
            dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TPlan");
#endif
        try
        {
            dataRoot = Path.GetFullPath(dataRoot);
            Directory.CreateDirectory(dataRoot);
            string identity;
            using (SHA256 sha = SHA256.Create())
                identity = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(dataRoot.ToUpperInvariant()))).Replace("-", "");
            bool first;
            using (Mutex mutex = new Mutex(true, @"Local\TPlan-" + identity, out first))
            using (EventWaitHandle activate = new EventWaitHandle(false, EventResetMode.AutoReset, @"Local\TPlan-Activate-" + identity))
            {
                if (!first) { activate.Set(); return; }
                using (TPlanWindow window = new TPlanWindow(dataRoot))
                {
                    RegisteredWaitHandle waiter = ThreadPool.RegisterWaitForSingleObject(activate, delegate {
                        try
                        {
                            if (!window.IsDisposed && window.IsHandleCreated)
                                window.BeginInvoke((Action)delegate {
                                    if (window.IsDisposed || window.Disposing) return;
                                    if (window.WindowState == FormWindowState.Minimized) window.WindowState = FormWindowState.Normal;
                                    window.Show(); window.Activate();
                                });
                        }
                        catch (InvalidOperationException) { /* Window closed while activation was queued. */ }
                    }, null, -1, false);
                    try { Application.Run(window); }
                    finally { waiter.Unregister(null); }
                }
                mutex.ReleaseMutex();
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show("T计划暂时无法启动。请确认当前用户可以写入本机应用数据目录，并将软件包完整解压后再打开。\n\n错误类型：" + ex.GetType().Name, "T计划", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}

internal sealed class TPlanWindow : Form
{
    private const string AppUrl = "https://tplan.local/index.html";
    private readonly string dataRoot;
    private readonly WebView2 web = new WebView2();
    private readonly Label loading = new Label();
    private bool closing;
    private TimerMiniWindow mini;
    private readonly JavaScriptSerializer timerMessages = new JavaScriptSerializer { MaxJsonLength = 4096 };
    private Dictionary<string, object> timerSnapshot;

    internal TPlanWindow(string root)
    {
        dataRoot = root;
        Text = "T计划 · 个人学习控制台";
        Size = new Size(1280, 900);
        MinimumSize = new Size(390, 600);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(250, 249, 245);
        AutoScaleMode = AutoScaleMode.Dpi;
        using (Stream iconStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("TPlan.icon.ico"))
            if (iconStream != null) Icon = new Icon(iconStream);
        loading.Text = "T计划\n正在打开你的学习控制台…";
        loading.Font = new Font("Microsoft YaHei UI", 16);
        loading.ForeColor = Color.FromArgb(31, 30, 29);
        loading.Dock = DockStyle.Fill;
        loading.TextAlign = ContentAlignment.MiddleCenter;
        web.Dock = DockStyle.Fill;
        web.DefaultBackgroundColor = BackColor;
        Controls.Add(web);
        Controls.Add(loading);
        Shown += async delegate { await InitializeWebView(); };
        FormClosing += delegate { closing = true; if(aiCancel!=null)aiCancel.Cancel(); };
        FormClosed += delegate { if (mini != null) mini.ShutDown(); if(ai!=null)ai.Dispose(); web.Dispose(); };
    }

    private async System.Threading.Tasks.Task InitializeWebView()
    {
        try
        {
            string runtime = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "runtime");
            if (!File.Exists(Path.Combine(runtime, "msedgewebview2.exe")))
                throw new FileNotFoundException("运行组件缺失，请完整解压软件包，保留 runtime 文件夹。不要只复制 T计划.exe。");
            EnsureWindows10RuntimeAccess(runtime);
            CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions();
            options.Language = "zh-CN";
            options.EnableTrackingPrevention = false;
            // Keep WebView2 crash dumps local; no custom uploader is implemented.
            options.IsCustomCrashReportingEnabled = true;
            // Offline product: no updater, external pages, telemetry or application requests.
            // Process-only WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS additions are used by QA;
            // no debugging port is present in shipped configuration or launch shortcuts.
            // Quote the complete resolver rule: an unquoted value is truncated to MAP.
            // Chromium's failing-resolution sentinel is ^NOTFOUND (not ~NOTFOUND).
            // Bypass the system proxy for this process, including speculative preconnects
            // to the virtual origin that WebResourceRequested serves entirely in memory.
            options.AdditionalBrowserArguments = "--disable-background-networking --disable-component-update --disable-domain-reliability --disable-sync --no-first-run --no-pings --no-proxy-server --disable-quic --host-resolver-rules=\"MAP * ^NOTFOUND\" --disable-features=msSmartScreenProtection";
            string profile = Path.Combine(dataRoot, "Profile");
            // WebView2 environment overrides otherwise take precedence over CreateAsync arguments.
            // Pin these only in this process so inherited developer settings cannot mix profiles.
            Environment.SetEnvironmentVariable("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", runtime, EnvironmentVariableTarget.Process);
            Environment.SetEnvironmentVariable("WEBVIEW2_USER_DATA_FOLDER", profile, EnvironmentVariableTarget.Process);
            CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(runtime, profile, options);
            if (closing || IsDisposed || Disposing) return;
            await web.EnsureCoreWebView2Async(environment);
            if (closing || IsDisposed || Disposing) return;
            CoreWebView2 core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.AreBrowserAcceleratorKeysEnabled = false;
            // Narrow local-only protocol for the native floating timer; no host objects or arbitrary commands.
            core.Settings.IsWebMessageEnabled = true;
            core.WebMessageReceived += OnTimerMessage;
            core.Settings.AreHostObjectsAllowed = false;
            core.Settings.IsPasswordAutosaveEnabled = false;
            core.Settings.IsGeneralAutofillEnabled = false;
            core.Settings.IsBuiltInErrorPageEnabled = false;
            core.Settings.IsSwipeNavigationEnabled = false;
            core.Settings.IsReputationCheckingRequired = false;
            core.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) {
                e.State = e.PermissionKind == CoreWebView2PermissionKind.ClipboardRead && e.IsUserInitiated && e.Uri.StartsWith("https://tplan.local/", StringComparison.Ordinal)
                    ? CoreWebView2PermissionState.Allow : CoreWebView2PermissionState.Deny;
            };
            core.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) {
                if (e.Uri != AppUrl && !e.Uri.StartsWith(AppUrl + "#", StringComparison.Ordinal) && !e.Uri.StartsWith("blob:https://tplan.local/", StringComparison.Ordinal)) e.Cancel = true;
            };
            core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object sender, CoreWebView2WebResourceRequestedEventArgs e) {
                if (e.Request.Uri == AppUrl && e.Request.Method == "GET")
                {
                    Stream content = Assembly.GetExecutingAssembly().GetManifestResourceStream("TPlan.index.html");
                    e.Response = environment.CreateWebResourceResponse(content, 200, "OK", "Content-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff");
                }
                else e.Response = environment.CreateWebResourceResponse(new MemoryStream(new byte[0]), 403, "Offline application", "Content-Type: text/plain");
            };
            core.DownloadStarting += OnDownloadStarting;
            core.DocumentTitleChanged += delegate {
                bool needsReview = core.DocumentTitle.StartsWith("该收尾了", StringComparison.Ordinal);
                bool alreadyNotified = Text.StartsWith("该收尾了", StringComparison.Ordinal);
                Text = core.DocumentTitle.Contains("T计划") ? core.DocumentTitle : "T计划 · 个人学习控制台";
#if TPLAN_CANDIDATE
                Text = "1.10.0候选 · 独立数据 | " + Text;
#endif
                if(Environment.GetEnvironmentVariable("TPLAN_QA_WINDOW")=="1") Text = "隔离验收（测试数据） | " + Text;
                if (needsReview && !alreadyNotified) System.Media.SystemSounds.Exclamation.Play();
            };
            core.NavigationCompleted += delegate(object sender, CoreWebView2NavigationCompletedEventArgs e) {
                if (e.IsSuccess) { loading.Visible = false; web.Focus(); }
                else { loading.Text = "打开失败，请关闭后重新启动 T计划。\n你的已保存数据仍留在本机。"; }
            };
            core.ProcessFailed += delegate { loading.Text = "显示组件暂时退出，请关闭后重新启动 T计划。\n你的已保存数据仍留在本机。"; loading.Visible = true; };
            core.Navigate(AppUrl);
        }
        catch (Exception ex)
        {
            if (closing || IsDisposed || Disposing) return;
            loading.Text = "T计划未能启动\n请确认软件包已完整解压。";
            // Diagnostic contains only the error type/code, never learning records.
            try { File.WriteAllText(Path.Combine(dataRoot, "startup-error.txt"), DateTime.UtcNow.ToString("o") + " " + ex.GetType().Name + " " + ex.HResult.ToString("X8")); } catch { }
            MessageBox.Show(this, ex is FileNotFoundException ? ex.Message : "显示组件初始化失败。请将软件包解压到本机普通文件夹后重试；若仍失败，请提供 startup-error.txt 中的错误类型和代码。", "T计划", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static void EnsureWindows10RuntimeAccess(string runtime)
    {
        // Microsoft's documented Fixed Runtime 120+ requirement for unpackaged Win32 on Win10.
        // ZIP files do not carry NTFS ACLs. Only this application's runtime directory is changed.
        if (Environment.OSVersion.Version.Major != 10 || Environment.OSVersion.Version.Build >= 22000) return;
        DirectoryInfo directory = new DirectoryInfo(runtime);
        DirectorySecurity security = directory.GetAccessControl();
        bool changed = false;
        foreach (string sid in new string[] { "S-1-15-2-1", "S-1-15-2-2" })
        {
            bool granted = false;
            foreach (FileSystemAccessRule rule in security.GetAccessRules(true, true, typeof(SecurityIdentifier)))
                if (rule.IdentityReference.Value == sid && rule.AccessControlType == AccessControlType.Allow &&
                    (rule.FileSystemRights & FileSystemRights.ReadAndExecute) == FileSystemRights.ReadAndExecute &&
                    (rule.InheritanceFlags & (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit)) == (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit)) granted = true;
            if (!granted)
            {
                security.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid), FileSystemRights.ReadAndExecute,
                    InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit, PropagationFlags.None, AccessControlType.Allow));
                changed = true;
            }
        }
        if (changed) directory.SetAccessControl(security);
    }

    private AiTaskService ai;
    private CancellationTokenSource aiCancel;
    private string aiRequest;
    private readonly JavaScriptSerializer aiJson = new JavaScriptSerializer { MaxJsonLength=70000, RecursionLimit=40 };
    private void AiReply(string request, string kind, object value) { if(!closing&&web.CoreWebView2!=null)web.CoreWebView2.PostWebMessageAsJson(aiJson.Serialize(new {kind=kind,requestId=request,value=value})); }
    private async void OnAiMessage(string raw) {
      try {
        var m=aiJson.Deserialize<Dictionary<string,object>>(raw); if(m==null||!m.ContainsKey("kind")||!m.ContainsKey("requestId"))return;
        string kind=Convert.ToString(m["kind"]),request=Convert.ToString(m["requestId"]);if(!System.Text.RegularExpressions.Regex.IsMatch(request,@"\A[a-zA-Z0-9_-]{1,100}\z"))return;
        if(ai==null)ai=new AiTaskService(dataRoot);
        if(kind=="ai-status"||kind=="ai-settings") {if(m.Count!=2)return; if(kind=="ai-settings"){BeginInvoke((Action)delegate{ai.ShowSettings(this);AiReply(request,"ai-status",new{configured=ai.Configured,enabled=ai.Enabled,model=ai.Model});});return;}AiReply(request,"ai-status",new{configured=ai.Configured,enabled=ai.Enabled,model=ai.Model});return;}
        if(kind=="ai-cancel") {if(m.Count==2&&aiRequest==request&&aiCancel!=null)aiCancel.Cancel();return;}
        if((kind!="ai-generate"&&kind!="ai-flow"&&kind!="ai-source")||m.Count!=3||!m.ContainsKey("input"))return;
        if(aiCancel!=null){AiReply(request,"ai-error","已有请求进行中，请先取消或等待完成。");return;}
        using(var cts=new CancellationTokenSource()){aiCancel=cts;aiRequest=request;cts.CancelAfter(TimeSpan.FromSeconds(90));
          try{string result=await ai.Generate(m["input"] as Dictionary<string,object>,cts.Token,kind=="ai-flow",kind=="ai-source");if(!cts.IsCancellationRequested)AiReply(request,"ai-result",result);}
          catch(OperationCanceledException){AiReply(request,"ai-error","请求已取消或超过90秒，原任务与草稿未改变。");}
          catch(InvalidOperationException ex){AiReply(request,"ai-error",ex.Message);}
          catch{AiReply(request,"ai-error","请求未完成，请检查设置后手动重试。");}
          finally{aiCancel=null;aiRequest=null;}
        }
      }catch{ }
    }
    private void OnTimerMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        if (closing || (e.Source != AppUrl && !e.Source.StartsWith(AppUrl + "#", StringComparison.Ordinal))) return;
        try
        {
            string raw = e.TryGetWebMessageAsString();
            if (raw == null || raw.Length > 60000) return;
            var envelope=aiJson.Deserialize<Dictionary<string,object>>(raw); object operation; if(envelope!=null&&envelope.TryGetValue("kind",out operation)&&Convert.ToString(operation).StartsWith("ai-",StringComparison.Ordinal)){OnAiMessage(raw);return;}
            if(raw.Length>4096)return;
            Dictionary<string, object> message = timerMessages.Deserialize<Dictionary<string, object>>(raw);
            object kind;
            if (message == null || !message.TryGetValue("kind", out kind)) return;
            if (Convert.ToString(kind) == "timer-state")
            {
                timerSnapshot = message;
                if (mini != null) mini.UpdateSnapshot(message);
            }
            else if (Convert.ToString(kind) == "timer-mini")
            {
                if (mini == null)
                {
                    mini = new TimerMiniWindow(ReturnToTimer, delegate(string command) {
                        if (!closing && (command == "pause" || command == "resume"))
                            web.CoreWebView2.PostWebMessageAsString("timer:" + command);
                    });
                    mini.Icon = Icon;
                    Rectangle area = Screen.FromControl(this).WorkingArea;
                    mini.Location = new Point(area.Right - mini.Width - 22, area.Top + 60);
                }
                if (timerSnapshot != null) mini.UpdateSnapshot(timerSnapshot);
                mini.KeepOnScreen(); mini.Show(); mini.TopMost = true;
                WindowState = FormWindowState.Minimized;
            }
        }
        catch (ArgumentException) { }
        catch (InvalidOperationException) { }
        catch (System.Runtime.InteropServices.COMException) { }
    }

    private void ReturnToTimer()
    {
        if (closing) return;
        if (mini != null) mini.Hide();
        Show(); WindowState = FormWindowState.Normal; Activate();
        if (web.CoreWebView2 != null) web.CoreWebView2.PostWebMessageAsString("timer:show");
    }

    private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)
    {
        e.Handled = true;
        if (!e.DownloadOperation.Uri.StartsWith("blob:https://tplan.local/", StringComparison.Ordinal)) { e.Cancel = true; return; }
        CoreWebView2Deferral deferral = e.GetDeferral();
        // Show the modal Windows picker after returning from the WebView2 event callback.
        // This follows Microsoft's DownloadStarting deferral pattern and avoids reentrancy.
        try { BeginInvoke((Action)delegate {
            using (deferral)
            {
                try
                {
                    using (SaveFileDialog picker = new SaveFileDialog())
                    {
                        picker.Title = "导出 T计划 数据";
                        picker.Filter = "JSON 数据备份 (*.json)|*.json";
                        picker.DefaultExt = "json";
                        picker.AddExtension = true;
                        picker.OverwritePrompt = true;
                        picker.FileName = "T计划_数据备份_" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".json";
                        if (picker.ShowDialog(this) != DialogResult.OK) e.Cancel = true;
                        else e.ResultFilePath = picker.FileName;
                    }
                }
                catch { e.Cancel = true; }
                // The SDK's Dispose completes this deferral exactly once.
            }
        }); }
        catch (InvalidOperationException) { e.Cancel = true; deferral.Dispose(); }
    }
}
