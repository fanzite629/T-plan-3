using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

internal sealed class CompanionPreferences
{
    public int Height=360,X=Int32.MinValue,Y=Int32.MinValue;
    public bool Visible=true,TopMost=true,Motion=true,IdleMotion=true,FollowTimer=true;
    public string Movement="still",Activity="idle";
}

// Independent, per-pixel-alpha window. Never owned by MainWindow: minimizing TPlan keeps her visible.
internal sealed class CompanionWindow : Form
{
    readonly string root,prefsPath;
    readonly Action back;
    readonly Action<string> command;
    readonly JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=2100000};
    readonly CompanionPanel panel;
    readonly Timer clock=new Timer();
    readonly NotifyIcon tray=new NotifyIcon();
    readonly ContextMenuStrip menu=new ContextMenuStrip();
    readonly Random random=new Random();
    readonly Image original;
    readonly Image[] wave=new Image[4];
    readonly Image[] walkLeft=new Image[8],walkRight=new Image[8];
    readonly Dictionary<string,Image[]> activityFrames=new Dictionary<string,Image[]>();
    readonly CompanionActivity activity;
    readonly Image blinkEyes;
    readonly CompanionMotion motion=new CompanionMotion(Environment.TickCount);
    readonly Stopwatch animationClock=Stopwatch.StartNew();
    readonly CompanionBlend transition=new CompanionBlend(),frameMixer=new CompanionBlend();
    readonly CompanionTravel travel=new CompanionTravel();
    readonly Dictionary<Image,Bitmap> spriteCache=new Dictionary<Image,Bitmap>();
    double lastAnimationAt,animationTime,lastPaintAt;
    long paintSequence;
    // Unattended acceptance runs must not capture the user's mouse. Never enabled in a normal launch.
    bool qaPassive=Environment.GetEnvironmentVariable("TPLAN_V3_QA")=="1"&&Environment.GetEnvironmentVariable("TPLAN_PET_PASSIVE")=="1";
    string lastPose="";
    CompanionPreferences prefs=new CompanionPreferences();
    Point mouseOrigin,windowOrigin,target;
    bool pressed,dragged,quitting,hasTarget;
    string phase="ready",title="",mode="down",notice="",lastCaption="";
    double budget,elapsed,receivedAt,noticeUntil,roamAt,remindAt;
    double waveAt=-1;
    int lastWave=-2;
    Rectangle bubble;
    internal event Action StateChanged;
    internal string LastPaintError="";
    internal string Movement {get{return prefs.Movement;}}
    internal int CharacterHeight {get{return prefs.Height;}}
    protected override bool ShowWithoutActivation {get{return true;}}
    protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x80000;if(qaPassive)p.ExStyle|=0x20;if(Environment.GetEnvironmentVariable("TPLAN_V3_QA")!="1")p.ExStyle|=0x80;return p;}}

    internal CompanionWindow(string dataRoot,Icon icon,CompanionAgent agent,Func<Dictionary<string,object>,string,string,Task<string>> draftAction,Action returnAction,Action<string> timerAction)
    {
        root=dataRoot;prefsPath=Path.Combine(root,"pet-settings.json");back=returnAction;command=timerAction;
        Text="T计划 · 橙橙桌宠";Name="TPlanCompanion";AccessibleName=Text;Icon=icon;
        FormBorderStyle=FormBorderStyle.None;StartPosition=FormStartPosition.Manual;ShowInTaskbar=Environment.GetEnvironmentVariable("TPLAN_V3_QA")=="1";AutoScaleMode=AutoScaleMode.None;
        original=LoadImage("original");blinkEyes=LoadImage("blink-eyes");for(int i=0;i<4;i++)wave[i]=LoadImage("wave"+i);
        for(int i=0;i<8;i++){walkLeft[i]=LoadImage("walk-left-"+i.ToString("00"));walkRight[i]=LoadImage("walk-right-"+i.ToString("00"));}
        foreach(string name in new[]{"study","read","rest"}){var frames=new Image[4];for(int i=0;i<4;i++)frames[i]=LoadImage("activity-"+name+"-"+i.ToString("00"));activityFrames.Add(name,frames);}
        try{if(File.Exists(prefsPath)&&new FileInfo(prefsPath).Length<20000)prefs=json.Deserialize<CompanionPreferences>(File.ReadAllText(prefsPath))??new CompanionPreferences();}catch{notice="偏好暂时无法读取，已使用默认位置";noticeUntil=Now()+6000;}
        prefs.Height=Math.Max(220,Math.Min(520,prefs.Height));if(prefs.Movement!="still"&&prefs.Movement!="roam"&&prefs.Movement!="follow")prefs.Movement="still";
        activity=new CompanionActivity(prefs.Activity,prefs.FollowTimer,animationTime);
        TopMost=prefs.TopMost;ResizePet();
        Rectangle area=Screen.PrimaryScreen.WorkingArea;
        Location=prefs.X==Int32.MinValue?new Point(area.Right-Width-28,area.Bottom-Height-18):new Point(prefs.X,prefs.Y);KeepOnScreen();
        panel=new CompanionPanel(root,agent,draftAction,timerAction,returnAction);panel.Icon=icon;
        BuildMenu();ContextMenuStrip=menu;tray.ContextMenuStrip=menu;tray.Icon=icon;tray.Text="橙橙 · T计划学习助理";tray.Visible=true;
        tray.DoubleClick+=delegate{ShowPanel();};menu.Opening+=delegate{RefreshMenu();};
        MouseDown+=OnMouseDown;MouseMove+=OnMouseMove;MouseUp+=OnMouseUp;MouseDoubleClick+=delegate(object s,MouseEventArgs e){if(e.Button==MouseButtons.Left)ShowPanel();};
        Shown+=delegate{KeepOnScreen();PaintPet();};VisibleChanged+=delegate{if(IsHandleCreated&&!IsDisposed&&Visible)PaintPet();};
        FormClosing+=delegate(object s,FormClosingEventArgs e){if(!quitting){e.Cancel=true;SetVisible(false);}};
        clock.Interval=16;clock.Tick+=delegate{Tick();};clock.Start();
        if(prefs.Visible)Show();
    }
    Image LoadImage(string name){using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("pet."+name+".png")){if(stream==null)throw new IOException("缺少桌宠图片："+name);using(var image=Image.FromStream(stream))return new Bitmap(image);}}
    static double Now(){return (DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds;}
    void ResizePet(){ClientSize=new Size(Math.Max(210,(int)Math.Ceiling(prefs.Height*640.0/768)+12),prefs.Height+72);foreach(var image in spriteCache.Values)image.Dispose();spriteCache.Clear();transition.Reset();lastWave=-2;lastPose="";}
    void BuildMenu()
    {
        Add("聊天与学习助理","panel",delegate{ShowPanel();});Add("招招手","wave",delegate{Greet();});Add("回到 T计划","main",delegate{back();});
        menu.Items.Add(new ToolStripSeparator());
        Add("暂停计时","timer",delegate{command(phase=="paused"?"resume":"pause");});Add("结束并填写记录","finish",delegate{command("end");back();});
        var actions=new ToolStripMenuItem("陪伴动作"){Name="activity"};
        var follow=new ToolStripMenuItem("跟随计时自动切换"){Name="follow-timer"};follow.Click+=delegate{SetFollowTimer(!activity.FollowTimer);};actions.DropDownItems.Add(follow);actions.DropDownItems.Add(new ToolStripSeparator());
        foreach(string value in new[]{"study","read","rest","idle"}){string choice=value;var option=new ToolStripMenuItem(value=="study"?"学习 · 写笔记":value=="read"?"看书 · 翻书页":value=="rest"?"休息 · 放松一下":"原图待机"){Name="act-"+value};option.Click+=delegate{SetActivity(choice);};actions.DropDownItems.Add(option);}menu.Items.Add(actions);
        menu.Items.Add(new ToolStripSeparator());
        Add("往左移动","left",delegate{MoveBy(-160);});Add("往右移动","right",delegate{MoveBy(160);});
        Add("自动漫游","roam",delegate{SetMovement(prefs.Movement=="roam"?"still":"roam");});
        Add("跟随鼠标","follow",delegate{SetMovement(prefs.Movement=="follow"?"still":"follow");});Add("停止移动","still",delegate{SetMovement("still");});
        var sizes=new ToolStripMenuItem("人物大小");foreach(int height in new[]{240,360,480}){int h=height;var b=new ToolStripMenuItem(height==240?"小 · 240":height==360?"标准 · 360":"大 · 480");b.Click+=delegate{SetSize(h);};sizes.DropDownItems.Add(b);}menu.Items.Add(sizes);
        Add("保持置顶","pin",delegate{TopMost=!TopMost;prefs.TopMost=TopMost;SavePreferences();Changed();});
        Add("开启招手动作","motion",delegate{prefs.Motion=!prefs.Motion;waveAt=-1;lastWave=-2;PaintPet();SavePreferences();Changed();});
        Add("待机眨眼与呼吸","idle",delegate{SetIdleMotion(!prefs.IdleMotion);});
        Add("20 分钟后提醒休息","remind",delegate{remindAt=Now()+20*60000;Say("好，20 分钟后提醒你休息。",5000);});
        Add("取消休息提醒","cancel-remind",delegate{remindAt=0;Say("本次提醒已取消。",4000);});
        menu.Items.Add(new ToolStripSeparator());
        Add("重置到屏幕右下角","reset",delegate{ResetPosition();});Add("暂时收起 / 显示","visible",delegate{SetVisible(!Visible);});
    }
    void Add(string label,string name,Action click){var item=new ToolStripMenuItem(label){Name=name};item.Click+=delegate{click();};menu.Items.Add(item);}
    ToolStripMenuItem Item(string name){return (ToolStripMenuItem)menu.Items[name];}
    void RefreshMenu(){Item("timer").Text=phase=="paused"?"继续计时":"暂停计时";Item("timer").Enabled=phase=="running"||phase=="paused";Item("finish").Enabled=phase=="running"||phase=="paused"||phase=="due";Item("roam").Checked=prefs.Movement=="roam";Item("follow").Checked=prefs.Movement=="follow";Item("pin").Checked=TopMost;Item("motion").Checked=prefs.Motion;Item("idle").Checked=prefs.IdleMotion;Item("visible").Text=Visible?"暂时收起桌宠":"显示桌宠";Item("cancel-remind").Enabled=remindAt>0;
        var actions=Item("activity");actions.Text="陪伴动作 · "+activity.Label;((ToolStripMenuItem)actions.DropDownItems["follow-timer"]).Checked=activity.FollowTimer;foreach(string value in new[]{"study","read","rest","idle"})((ToolStripMenuItem)actions.DropDownItems["act-"+value]).Checked=activity.Current==value;
    }
    internal void ShowPanel(){if(!Visible)SetVisible(true);panel.Show();panel.WindowState=FormWindowState.Normal;panel.Activate();}
    internal void Control(string action)
    {
        if(action=="panel")ShowPanel();else if(action=="show")SetVisible(true);else if(action=="hide")SetVisible(false);else if(action=="wave")Greet();
        else if(action=="left")MoveBy(-160);else if(action=="right")MoveBy(160);else if(action=="roam"||action=="follow"||action=="still")SetMovement(action);
        else if(action=="reset")ResetPosition();else if(action=="small")SetSize(240);else if(action=="normal")SetSize(360);else if(action=="large")SetSize(480);
        else if(action=="idle-on")SetIdleMotion(true);else if(action=="idle-off")SetIdleMotion(false);
        else if(action=="activity-study"||action=="activity-read"||action=="activity-rest"||action=="activity-idle")SetActivity(action.Substring(9));
        else if(action=="activity-auto-on")SetFollowTimer(true);else if(action=="activity-auto-off")SetFollowTimer(false);
        else if(action=="qa-interactive"&&Environment.GetEnvironmentVariable("TPLAN_V3_QA")=="1"){qaPassive=false;UpdateStyles();}
    }
    void ApplyActivity(){hasTarget=false;travel.Reset();waveAt=-1;noticeUntil=0;motion.Sample(animationTime,0,0,prefs.Height,false);prefs.Activity=activity.Current;prefs.FollowTimer=activity.FollowTimer;panel.SetScene(activity.Current=="rest"?"life":activity.Current=="idle"?"desk":activity.Current);lastPose="";PaintPet();SavePreferences();Changed();}
    void SetActivity(string value){activity.Choose(value,animationTime);ApplyActivity();}
    void SetFollowTimer(bool enabled){activity.Follow(enabled,animationTime);ApplyActivity();}
    void SetIdleMotion(bool enabled){prefs.IdleMotion=enabled;motion.Sample(animationTime,0,0,prefs.Height,enabled);lastPose="";PaintPet();SavePreferences();Changed();}
    void SetVisible(bool show){prefs.Visible=show;if(show){Show();KeepOnScreen();PaintPet();}else{Hide();pressed=false;hasTarget=false;travel.Reset();motion.Sample(animationTime,0,0,prefs.Height,false);transition.Reset();}SavePreferences();Changed();}
    void SetSize(int height){int bottom=Bottom;prefs.Height=height;ResizePet();Top=bottom-Height;KeepOnScreen();PaintPet();SavePreferences();Changed();}
    void ResetPosition(){SetMovement("still");var a=Screen.FromPoint(Cursor.Position).WorkingArea;Location=new Point(a.Right-Width-28,a.Bottom-Height-18);KeepOnScreen();SetVisible(true);}
    void SetMovement(string value){prefs.Movement=value;hasTarget=false;travel.Reset();roamAt=0;if(value!="still"&&phase!="running"&&activity.Current!="idle")SetActivity("idle");SavePreferences();Say(value=="still"?"我就在这里陪你。":value=="roam"?"我走动一下，专注计时时会安静待着。":"我跟着鼠标走；右键可以停止。",5000);Changed();}
    void MoveBy(int x){prefs.Movement="still";target=ClampPoint(new Point(Left+x,Top));hasTarget=true;travel.Reset();SavePreferences();Changed();}
    void OnMouseDown(object sender,MouseEventArgs e){if(qaPassive||e.Button!=MouseButtons.Left)return;pressed=true;dragged=false;mouseOrigin=PointToScreen(e.Location);windowOrigin=Location;Capture=true;hasTarget=false;travel.Reset();}
    void OnMouseMove(object sender,MouseEventArgs e){if(!pressed)return;var p=PointToScreen(e.Location);int dx=p.X-mouseOrigin.X,dy=p.Y-mouseOrigin.Y;if(Math.Abs(dx)+Math.Abs(dy)>5)dragged=true;if(dragged)Location=ClampPoint(new Point(windowOrigin.X+dx,windowOrigin.Y+dy));}
    void OnMouseUp(object sender,MouseEventArgs e){if(e.Button!=MouseButtons.Left||!pressed)return;if(!dragged){var p=PointToScreen(e.Location);int dx=p.X-mouseOrigin.X,dy=p.Y-mouseOrigin.Y;if(Math.Abs(dx)+Math.Abs(dy)>5){dragged=true;Location=ClampPoint(new Point(windowOrigin.X+dx,windowOrigin.Y+dy));}}pressed=false;Capture=false;if(dragged){roamAt=Now()+6000;SavePreferences();Changed();}else if(bubble.Contains(e.Location))ShowPanel();else Greet();}
    void Greet(){if(prefs.Motion)waveAt=animationTime;Say(new[]{"我在呢，双击我就能聊天。","先推进眼前的一小步吧。","需要一起想想下一步吗？"}[random.Next(3)],4500);}
    void Say(string text,int ms){notice=text;noticeUntil=Now()+ms;lastCaption="";PaintPet();}
    Point ClampPoint(Point p){Rectangle a=Screen.FromPoint(new Point(p.X+Width/2,p.Y+Height/2)).WorkingArea;return new Point(Math.Max(a.Left,Math.Min(p.X,a.Right-Width)),Math.Max(a.Top,Math.Min(p.Y,a.Bottom-Height)));}
    internal void KeepOnScreen(){Location=ClampPoint(Location);}
    static double Number(Dictionary<string,object> d,string k){object v;double n;return d.TryGetValue(k,out v)&&Double.TryParse(Convert.ToString(v,CultureInfo.InvariantCulture),NumberStyles.Float,CultureInfo.InvariantCulture,out n)&&!Double.IsNaN(n)&&!Double.IsInfinity(n)?Math.Max(0,n):0;}
    internal void UpdateSnapshot(Dictionary<string,object> d)
    {
        object v;string previous=phase;phase=d.TryGetValue("phase",out v)?Convert.ToString(v):"ready";title=d.TryGetValue("title",out v)?Convert.ToString(v):"";mode=d.TryGetValue("mode",out v)?Convert.ToString(v):"down";
        budget=Number(d,"budgetMs");elapsed=Number(d,"elapsedMs");receivedAt=Number(d,"at");
        if(previous!="due"&&phase=="due")Say("这一轮时间到了，记下刚才的收获吧。",10000);
        bool changed=activity.UpdateTimer(phase,animationTime);
        if(changed||(activity.FollowTimer&&previous!=phase&&phase!="ready"))ApplyActivity();
        else if(previous!=phase&&phase=="running"){hasTarget=false;travel.Reset();waveAt=-1;motion.Sample(animationTime,0,0,prefs.Height,false);lastPose="";PaintPet();}
        panel.UpdateTimer(phase,Caption());if(Visible&&Caption()!=lastCaption)PaintPet();
    }
    string Caption(){if(Now()<noticeUntil)return notice;long seconds=(long)Math.Max(0,Math.Round((mode=="down"?budget-elapsed-(phase=="running"?Now()-receivedAt:0):elapsed+(phase=="running"?Now()-receivedAt:0))/1000));string time=(seconds/60).ToString("00")+":"+(seconds%60).ToString("00");string label=activity.Label;return phase=="running"?label+" · "+time:phase=="paused"?label+" · 已暂停 "+time:phase=="due"?label+" · 时间到，填写记录":phase=="ended"?label+" · 这一轮结束了":activity.Current=="idle"?"橙橙 · 双击聊天 / 右键更多":label+" · 右键切换陪伴动作";}
    string PoseKey(int frame){return motion.Walking||frame>=0||activity.Current=="idle"?motion.Key(frame):activity.Key(animationTime);}
    string PoseGroup(int frame){return motion.Walking?"walk-"+(motion.FacingRight?"right":"left"):frame>=0?"wave":activity.Current;}
    int WaveFrame(){double t=animationTime-waveAt;if(waveAt<0||t>=1400)return -1;return t<250?0:t<550?1:t<900?2:3;}
    void Tick()
    {
        double now=Now();if(remindAt>0&&now>=remindAt){remindAt=0;Say("到了约定的休息时间，活动一下吧。",12000);if(!Visible){tray.BalloonTipTitle="橙橙提醒";tray.BalloonTipText="到了约定的休息时间，活动一下吧。";tray.ShowBalloonTip(7000);}}
        double animationAt=animationClock.Elapsed.TotalMilliseconds,dt=Math.Max(0,Math.Min(80,animationAt-lastAnimationAt));lastAnimationAt=animationAt;
        if(!Visible||pressed||menu.Visible)return;
        animationTime+=dt;
        Point prior=Location;
        if(prefs.Movement=="follow"&&phase!="running"&&activity.Current=="idle"){target=ClampPoint(new Point(Cursor.Position.X-Width/2,Cursor.Position.Y-Height-25));hasTarget=true;}
        else if(prefs.Movement=="roam"&&phase!="running"&&activity.Current=="idle"&&now>=roamAt){var a=Screen.FromControl(this).WorkingArea;target=ClampPoint(new Point(a.Left+random.Next(Math.Max(1,a.Width-Width)),Top));hasTarget=true;roamAt=now+9000;}
        if(hasTarget&&WaveFrame()<0){Location=ClampPoint(travel.Advance(Location,target,dt,prefs.Height));if(Location==target){hasTarget=false;travel.Reset();if(prefs.X!=Left||prefs.Y!=Top)SavePreferences();}}
        // A subpixel step may not move the integer window this tick. Preserve the
        // preceding gait until the next real displacement, rather than flickering idle.
        if(Location!=prior||!hasTarget||WaveFrame()>=0)motion.Sample(animationTime,Left-prior.X,Top-prior.Y,prefs.Height,prefs.IdleMotion&&WaveFrame()<0);
        string caption=Caption();int frame=WaveFrame();bool animated=transition.Active||motion.Walking||frame>=0||activity.Current!="idle";
        if(caption!=lastCaption||(Math.Floor(animationTime*30/1000)>Math.Floor(lastPaintAt*30/1000)&&(animated||frame!=lastWave||lastPose!=PoseKey(frame))))PaintPet();
    }
    Bitmap Sprite(Image image,bool greeting)
    {
        Bitmap cached;if(spriteCache.TryGetValue(image,out cached))return cached;
        cached=new Bitmap(Width,Height,PixelFormat.Format32bppPArgb);using(var g=Graphics.FromImage(cached)){g.Clear(Color.Transparent);g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.CompositingQuality=CompositingQuality.HighQuality;float scale=greeting?Math.Min((Width-12f)/image.Width,prefs.Height/(float)image.Height):prefs.Height/768f;g.DrawImage(image,(Width-image.Width*scale)/2,Height-image.Height*scale-4,image.Width*scale,image.Height*scale);}spriteCache.Add(image,cached);return cached;
    }
    Bitmap ComposePose(int frame)
    {
        var result=new Bitmap(Width,Height,PixelFormat.Format32bppPArgb);
        if(motion.Walking){var frames=motion.FacingRight?walkRight:walkLeft;frameMixer.Mix(Sprite(frames[motion.Frame],false),Sprite(frames[(motion.Frame+1)%8],false),result,CompanionBlend.Ease(motion.FrameMix));}
        else if(frame>=0){int[] durations={250,300,350,500};double elapsed=animationTime-waveAt;for(int i=0;i<frame;i++)elapsed-=durations[i];double mix=frame==3?0:CompanionBlend.Ease((elapsed-durations[frame]+160)/160);frameMixer.Mix(Sprite(wave[frame],true),Sprite(wave[Math.Min(3,frame+1)],true),result,mix);}
        else if(activity.Current!="idle"){var frames=activityFrames[activity.Current];int i=activity.Frame(animationTime);frameMixer.Mix(Sprite(frames[i],false),Sprite(frames[(i+1)%4],false),result,activity.FrameMix(animationTime));}
        else using(var g=Graphics.FromImage(result)){g.Clear(Color.Transparent);g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.CompositingQuality=CompositingQuality.HighQuality;float scale=prefs.Height/(float)original.Height,iw=original.Width*scale;CompanionMotion.DrawIdle(g,original,blinkEyes,new RectangleF((Width-iw)/2,Height-prefs.Height-4,iw,prefs.Height),motion.BreathPixels,motion.Blinking);}
        return result;
    }
    void PaintPet()
    {
        if(!IsHandleCreated||IsDisposed||!Visible)return;
        string text=Caption();int frame=WaveFrame();lastCaption=text;lastWave=frame;lastPose=PoseKey(frame);
        using(var bitmap=new Bitmap(Width,Height,PixelFormat.Format32bppPArgb))using(var g=Graphics.FromImage(bitmap)){
            g.Clear(Color.Transparent);g.SmoothingMode=SmoothingMode.AntiAlias;g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.CompositingQuality=CompositingQuality.HighQuality;
            using(var pose=ComposePose(frame))g.DrawImageUnscaled(transition.Render(pose,PoseGroup(frame),animationTime),0,0);
            bubble=new Rectangle(4,3,Width-8,45);using(var p=Rounded(bubble,12))using(var b=new SolidBrush(Color.FromArgb(244,250,249,246)))using(var pen=new Pen(Color.FromArgb(210,220,218,212))){g.FillPath(b,p);g.DrawPath(pen,p);}
            using(var font=new Font("Microsoft YaHei UI",9))using(var brush=new SolidBrush(Color.FromArgb(38,38,38)))using(var format=new StringFormat {Alignment=StringAlignment.Center,LineAlignment=StringAlignment.Center,Trimming=StringTrimming.EllipsisCharacter})g.DrawString(text,font,brush,new RectangleF(12,5,Width-24,39),format);
            AccessibleDescription=text+"。单击招手，双击聊天，右键菜单，按住人物拖动。";
            Present(bitmap);
        }
        lastPaintAt=animationTime;paintSequence++;
        if(Environment.GetEnvironmentVariable("TPLAN_V3_QA")=="1")Changed();
    }
    static GraphicsPath Rounded(Rectangle r,int radius){int d=radius*2;var p=new GraphicsPath();p.AddArc(r.Left,r.Top,d,d,180,90);p.AddArc(r.Right-d,r.Top,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.Left,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
    void SavePreferences(){prefs.X=Left;prefs.Y=Top;try{string tmp=prefsPath+".tmp";File.WriteAllText(tmp,json.Serialize(prefs));if(File.Exists(prefsPath))File.Replace(tmp,prefsPath,null);else File.Move(tmp,prefsPath);}catch{notice="桌宠偏好未保存，请检查数据目录";noticeUntil=Now()+5000;}}
    void Changed(){var handler=StateChanged;if(handler!=null)handler();}
    internal object Snapshot(){return new {visible=Visible,topMost=TopMost,height=prefs.Height,movement=prefs.Movement,bounds=Bounds.ToString(),phase=phase,caption=Caption(),panelVisible=panel.Visible,paintError=LastPaintError,walking=motion.Walking,facing=motion.FacingRight?"right":"left",walkFrame=motion.Frame,blinking=motion.Blinking,breath=motion.BreathPixels,idleMotion=prefs.IdleMotion,activity=activity.Current,followTimer=activity.FollowTimer,activityFrame=activity.Frame(animationTime),pose=lastPose,transitioning=transition.Active,transitionProgress=transition.Progress,transitionFrom=transition.From,transitionTo=transition.To,frameMix=motion.Walking?motion.FrameMix:activity.FrameMix(animationTime),paintSequence=paintSequence,animationTime=animationTime,moveSpeed=travel.Speed};}
    internal void ShutDown(){if(quitting)return;quitting=true;SavePreferences();clock.Stop();clock.Dispose();tray.Visible=false;tray.Dispose();panel.ShutDown();menu.Dispose();transition.Dispose();frameMixer.Dispose();foreach(var image in spriteCache.Values)image.Dispose();spriteCache.Clear();original.Dispose();blinkEyes.Dispose();foreach(var im in wave)im.Dispose();foreach(var im in walkLeft)im.Dispose();foreach(var im in walkRight)im.Dispose();foreach(var frames in activityFrames.Values)foreach(var im in frames)im.Dispose();Close();Dispose();}

    [StructLayout(LayoutKind.Sequential)]struct POINT{public int X,Y;public POINT(int x,int y){X=x;Y=y;}}
    [StructLayout(LayoutKind.Sequential)]struct SIZE{public int CX,CY;public SIZE(int x,int y){CX=x;CY=y;}}
    [StructLayout(LayoutKind.Sequential,Pack=1)]struct BLEND{public byte Op,Flags,Alpha,Format;}
    [DllImport("user32.dll",SetLastError=true)]static extern bool UpdateLayeredWindow(IntPtr hwnd,IntPtr dest,ref POINT location,ref SIZE size,IntPtr source,ref POINT src,uint key,ref BLEND blend,uint flags);
    [DllImport("user32.dll")]static extern IntPtr GetDC(IntPtr hwnd);
    [DllImport("user32.dll")]static extern int ReleaseDC(IntPtr hwnd,IntPtr dc);
    [DllImport("gdi32.dll")]static extern IntPtr CreateCompatibleDC(IntPtr dc);
    [DllImport("gdi32.dll")]static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")]static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
    [DllImport("gdi32.dll")]static extern bool DeleteObject(IntPtr obj);
    void Present(Bitmap bitmap)
    {
        IntPtr screen=GetDC(IntPtr.Zero),memory=CreateCompatibleDC(screen),handle=IntPtr.Zero,old=IntPtr.Zero;
        try{handle=bitmap.GetHbitmap(Color.FromArgb(0));old=SelectObject(memory,handle);var pt=new POINT(Left,Top);var size=new SIZE(bitmap.Width,bitmap.Height);var src=new POINT(0,0);var blend=new BLEND {Op=0,Flags=0,Alpha=255,Format=1};if(!UpdateLayeredWindow(Handle,screen,ref pt,ref size,memory,ref src,0,ref blend,2))LastPaintError="透明窗口绘制失败："+Marshal.GetLastWin32Error();else LastPaintError="";}
        finally{if(old!=IntPtr.Zero)SelectObject(memory,old);if(handle!=IntPtr.Zero)DeleteObject(handle);DeleteDC(memory);ReleaseDC(IntPtr.Zero,screen);}
    }
}
