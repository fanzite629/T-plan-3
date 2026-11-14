using System;
using System.Collections;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// A companion conversation is local; only a user-initiated message calls the configured model.
internal sealed class CompanionPanel : Form
{
    readonly CompanionAgent agent;
    readonly Func<Dictionary<string,object>,string,string,Task<string>> openDraft;
    readonly Action<string> timerCommand;
    readonly string historyPath;
    readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=2100000};
    readonly List<Dictionary<string,string>> history=new List<Dictionary<string,string>>();
    readonly RichTextBox transcript=new RichTextBox();
    readonly TextBox input=new TextBox();
    readonly Button send=new Button(),cancel=new Button(),proposal=new Button(),pause=new Button();
    readonly Label status=new Label(),privacy=new Label();
    readonly PictureBox scene=new PictureBox();
    readonly Dictionary<string,Image> scenes=new Dictionary<string,Image>();
    Dictionary<string,object> pendingDraft;
    string requestId="",draftId="",draftPrompt="",phase="ready";
    bool quitting,busy;

    internal CompanionPanel(string root,CompanionAgent service,Func<Dictionary<string,object>,string,string,Task<string>> draftAction,Action<string> timerAction,Action back)
    {
        agent=service;openDraft=draftAction;timerCommand=timerAction;historyPath=Path.Combine(root,"pet-chat.json");
        Text="橙橙 · T计划学习助理";Name="TPlanCompanionPanel";AccessibleName=Text;
        Size=new Size(590,790);MinimumSize=new Size(480,650);StartPosition=FormStartPosition.CenterScreen;
        Font=new Font("Microsoft YaHei UI",9);BackColor=Color.FromArgb(248,247,244);ForeColor=Color.FromArgb(35,35,35);
        var layout=new TableLayoutPanel {Dock=DockStyle.Fill,Padding=new Padding(14),ColumnCount=1,RowCount=8};
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,36));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,170));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,32));layout.RowStyles.Add(new RowStyle(SizeType.Percent,100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,38));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,38));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute,80));layout.RowStyles.Add(new RowStyle(SizeType.Absolute,40));
        Controls.Add(layout);
        var tabs=new FlowLayoutPanel {Dock=DockStyle.Fill,WrapContents=false};
        string[] keys={"desk","study","game","read","life"},labels={"小屋","学习","娱乐","看书","生活"};
        for(int i=0;i<keys.Length;i++){string k=keys[i];var b=Button(labels[i]);b.Click+=delegate{SetScene(k);};tabs.Controls.Add(b);}
        layout.Controls.Add(tabs,0,0);
        scene.Dock=DockStyle.Fill;scene.SizeMode=PictureBoxSizeMode.Zoom;scene.BackColor=Color.FromArgb(244,240,232);layout.Controls.Add(scene,0,1);SetScene("desk");
        status.Dock=DockStyle.Fill;status.TextAlign=ContentAlignment.MiddleLeft;status.Text="陪你把下一步想清楚";layout.Controls.Add(status,0,2);
        transcript.Dock=DockStyle.Fill;transcript.ReadOnly=true;transcript.DetectUrls=false;transcript.BorderStyle=BorderStyle.None;transcript.BackColor=Color.White;transcript.Font=new Font(Font.FontFamily,10);transcript.Name="CompanionConversation";transcript.AccessibleName="与橙橙的对话";layout.Controls.Add(transcript,0,3);
        var quick=new FlowLayoutPanel {Dock=DockStyle.Fill,WrapContents=false};
        AddQuick(quick,"选下一步","请结合我当前的任务，帮我选一个现在能做的小行动，先不要创建任务。");
        AddQuick(quick,"拆解目标","帮我把这个目标拆成可执行的任务：");
        AddQuick(quick,"今日复盘","请仅依据今天已有的时间记录，帮我复盘；把未记录和不确定的部分说清楚。");
        var clear=Button("清空对话");clear.Click+=delegate{if(busy)return;if(MessageBox.Show(this,"清空本机的桌宠对话？任务和计时记录不受影响。","清空对话",MessageBoxButtons.OKCancel)==DialogResult.OK){history.Clear();transcript.Clear();pendingDraft=null;proposal.Enabled=false;SaveHistory();Welcome();}};quick.Controls.Add(clear);layout.Controls.Add(quick,0,4);
        var tools=new FlowLayoutPanel {Dock=DockStyle.Fill,WrapContents=false};
        Style(pause,"暂停/继续");pause.Name="CompanionPause";pause.Click+=delegate{timerCommand(phase=="paused"?"resume":"pause");};tools.Controls.Add(pause);
        var timer=Button("打开计时");timer.Click+=delegate{back();};tools.Controls.Add(timer);
        Style(proposal,"检查任务草稿");proposal.Name="CompanionProposal";proposal.Enabled=false;proposal.Width=132;proposal.Click+=async delegate{await ShowDraft();};tools.Controls.Add(proposal);layout.Controls.Add(tools,0,5);
        input.Dock=DockStyle.Fill;input.Multiline=true;input.MaxLength=4000;input.ScrollBars=ScrollBars.Vertical;input.Name="CompanionInput";input.AccessibleName="给橙橙的消息";input.KeyDown+=async delegate(object s,KeyEventArgs e){if(e.Control&&e.KeyCode==Keys.Enter){e.SuppressKeyPress=true;await Send();}};layout.Controls.Add(input,0,6);
        var actions=new FlowLayoutPanel {Dock=DockStyle.Fill,WrapContents=false};
        Style(send,"发送");send.Name="CompanionSend";send.Click+=async delegate{await Send();};Style(cancel,"取消生成");cancel.Enabled=false;cancel.Click+=delegate{if(requestId!="")agent.Cancel(requestId);};actions.Controls.Add(send);actions.Controls.Add(cancel);
        privacy.AutoSize=false;privacy.Width=330;privacy.Height=36;privacy.Text="Ctrl+Enter 发送 · 使用 T计划模型配置\n发送本次问题、近期对话及任务/计时摘要";privacy.ForeColor=Color.DimGray;actions.Controls.Add(privacy);layout.Controls.Add(actions,0,7);
        FormClosing+=delegate(object s,FormClosingEventArgs e){if(!quitting){e.Cancel=true;Hide();}};
        LoadHistory();if(history.Count==0)Welcome();
    }
    static Button Button(string text){var b=new Button();Style(b,text);return b;}
    static void Style(Button b,string text){b.Text=text;b.AccessibleName=text;b.AutoSize=true;b.Height=30;b.FlatStyle=FlatStyle.Flat;b.FlatAppearance.BorderColor=Color.FromArgb(218,215,210);b.BackColor=Color.White;b.Margin=new Padding(0,2,6,2);b.Cursor=Cursors.Hand;}
    void AddQuick(FlowLayoutPanel parent,string label,string text){var b=Button(label);b.Click+=delegate{input.Text=text;input.SelectionStart=input.TextLength;input.Focus();};parent.Controls.Add(b);}
    internal void SetScene(string key)
    {
        if(!scenes.ContainsKey(key)){using(var s=Assembly.GetExecutingAssembly().GetManifestResourceStream("pet."+key+".png")){if(s==null)return;using(var im=Image.FromStream(s))scenes[key]=new Bitmap(im);}}
        scene.Image=scenes[key];
    }
    void Welcome(){Append("橙橙","我在这里。可以一起选下一步、解释学习问题，或整理任务草稿。新增任务会先让你检查，再由你确认写入。");}
    void Append(string who,string text){transcript.SelectionStart=transcript.TextLength;transcript.SelectionFont=new Font(transcript.Font,FontStyle.Bold);transcript.AppendText(who+"\n");transcript.SelectionFont=transcript.Font;transcript.AppendText(text+"\n\n");transcript.ScrollToCaret();}
    async Task Send()
    {
        if(busy||String.IsNullOrWhiteSpace(input.Text))return;
        string message=input.Text.Trim();var previous=new List<Dictionary<string,string>>(history);
        input.Clear();Append("我",message);history.Add(new Dictionary<string,string>{{"role","user"},{"content",message}});SaveHistory();
        busy=true;send.Enabled=false;cancel.Enabled=true;proposal.Enabled=false;requestId="pet_"+Guid.NewGuid().ToString("N");status.Text="橙橙正在想…";
        try{
            var answer=await agent.Ask(requestId,message,previous);if(quitting||IsDisposed)return;
            Append("橙橙",answer.reply);history.Add(new Dictionary<string,string>{{"role","assistant"},{"content",answer.reply}});SaveHistory();
            pendingDraft=answer.draft;draftId=requestId;draftPrompt=message;proposal.Enabled=pendingDraft!=null;proposal.Text="检查任务草稿";
            if(pendingDraft!=null){var preview=new System.Text.StringBuilder();foreach(Dictionary<string,object> row in (ArrayList)pendingDraft["items"]){object title,minutes,date;row.TryGetValue("title",out title);row.TryGetValue("minutes",out minutes);row.TryGetValue("date",out date);preview.Append("• "+Convert.ToString(title)+" · "+Convert.ToString(minutes)+" 分钟 · "+(date==null?"日期未定":Convert.ToString(date))+"\n");}Append("待确认草稿",preview+"\n点击“检查任务草稿”进入可编辑预览；目前没有新增任务。");}
        }catch(Exception ex){if(!quitting&&!IsDisposed){Append("提示",ex is InvalidOperationException?ex.Message:"本次请求未完成，请稍后重试。");if(input.Text.Length==0)input.Text=message;}}
        finally{busy=false;requestId="";if(!quitting&&!IsDisposed){send.Enabled=true;cancel.Enabled=false;proposal.Enabled=pendingDraft!=null;status.Text="由 T计划当前配置的模型提供回答";}}
    }
    async Task ShowDraft()
    {
        if(pendingDraft==null||busy)return;proposal.Enabled=false;
        try{string result=await openDraft(pendingDraft,draftId,draftPrompt);var d=json.Deserialize<Dictionary<string,object>>(result);object v;if(d==null||!d.TryGetValue("ok",out v)||!Convert.ToBoolean(v))throw new InvalidOperationException(d!=null&&d.TryGetValue("error",out v)?Convert.ToString(v):"草稿尚未保存，请重试。");Append("提示","已打开 T计划中的草稿。请检查日期与时长，确认后才会加入任务。");proposal.Text="再次查看草稿";}
        catch(Exception ex){Append("提示",ex.Message);}finally{if(!IsDisposed)proposal.Enabled=true;}
    }
    internal void UpdateTimer(string state,string text){phase=state;pause.Text=phase=="paused"?"继续计时":"暂停计时";pause.Enabled=phase=="paused"||phase=="running";if(!busy)status.Text=text;}
    void LoadHistory(){try{if(!File.Exists(historyPath)||new FileInfo(historyPath).Length>2000000)return;var list=json.Deserialize<List<Dictionary<string,string>>>(File.ReadAllText(historyPath));foreach(var m in list){if(!m.ContainsKey("role")||!m.ContainsKey("content")||m["content"].Length>10000)continue;history.Add(m);Append(m["role"]=="user"?"我":"橙橙",m["content"]);}}catch{Append("提示","旧对话暂时无法读取，原文件仍保留。");}}
    void SaveHistory(){try{while(history.Count>40)history.RemoveAt(0);string tmp=historyPath+".tmp";File.WriteAllText(tmp,json.Serialize(history),new System.Text.UTF8Encoding(false));if(File.Exists(historyPath))File.Replace(tmp,historyPath,null);else File.Move(tmp,historyPath);}catch{privacy.Text="对话保存失败 · 本轮仍可继续，关闭前可复制文字";}}
    internal void ShutDown(){quitting=true;if(requestId!="")agent.Cancel(requestId);Close();foreach(var im in scenes.Values)im.Dispose();scenes.Clear();Dispose();}
}
