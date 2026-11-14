using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Windows.Forms;

// Unowned, so minimizing the main window leaves the timer accessible.
internal sealed class TimerMiniWindow : Form
{
    readonly Label task = new Label(), digits = new TimerDigits(), status = new Label(), caption = new Label(), footer = new Label();
    readonly Button pause = new Button(), add = new Button(), finish = new Button(), restore = new Button(), pin = new Button(), compact = new Button();
    readonly Panel track = new Panel();
    readonly Timer clock = new Timer();
    readonly ToolTip hints = new ToolTip();
    readonly Action back;
    readonly Action<string> command;
    string phase = "ready", mode = "down", pending = "", error = "";
    double budget, elapsed, receivedAt, pendingAt;
    bool quitting, small, dark;
    Color surface, ink, muted, line, soft;
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr handle, int message, IntPtr w, IntPtr l);

    internal TimerMiniWindow(Action returnToMain, Action<string> control)
    {
        back = returnToMain; command = control;
        Text = "T计划 v3 · 计时小窗"; Name = "TPlanV3MiniTimer"; AccessibleName = "T计划计时小窗";
        AutoScaleDimensions = new SizeF(96, 96); AutoScaleMode = AutoScaleMode.Dpi;
        FormBorderStyle = FormBorderStyle.None; StartPosition = FormStartPosition.Manual;
        TopMost = true; ShowInTaskbar = true; DoubleBuffered = true; KeyPreview = true;
        Font = new Font("Microsoft YaHei UI", 9);
        task.AutoEllipsis = true; task.AccessibleName = "当前任务"; task.Name = "MiniTask";
        pin.Name = "MiniPin"; compact.Name = "MiniCompact"; restore.Name = "MiniRestore";
        pause.Name = "MiniPause"; add.Name = "MiniAdd5"; finish.Name = "MiniEnd";
        digits.Name = "MiniClock"; status.Name = "MiniStatus"; caption.Name = "MiniCaption";
        digits.TextAlign = status.TextAlign = caption.TextAlign = footer.TextAlign = ContentAlignment.MiddleCenter;
        digits.Text = "00:00"; task.Font = new Font(Font, FontStyle.Bold);
        pin.Click += delegate { TogglePin(); };
        compact.Click += delegate { small = !small; Arrange(); ApplyTheme(); KeepOnScreen(); };
        restore.Click += delegate { back(); };
        pause.Click += delegate { Send(phase == "paused" ? "resume" : "pause"); };
        add.Click += delegate { Send("add5"); };
        finish.Click += delegate { Send("end"); };
        hints.SetToolTip(restore, "收起小窗并返回计时页 · Esc");
        hints.SetToolTip(compact, "切换标准 / 紧凑布局");
        hints.SetToolTip(pause, "暂停或继续 · F8");
        hints.SetToolTip(finish, "结束计时，回到主页面填写记录 · Ctrl+Enter");
        hints.SetToolTip(add, "增加 5 分钟；暂停时增加不会自动继续");
        track.Paint += delegate(object sender, PaintEventArgs e) {
            double value = ElapsedNow(), progress = mode == "down" ? value / Math.Max(1, budget) : (value % 3600000) / 3600000;
            using(var brush = new SolidBrush(ink)) e.Graphics.FillRectangle(brush, 0, 0, (float)(track.Width * Math.Max(0, Math.Min(1, progress))), track.Height);
        };
        Controls.AddRange(new Control[] {task, pin, compact, restore, caption, digits, status, pause, add, finish, footer, track});
        foreach(Control surfaceControl in new Control[] {this, task, digits, status, caption, footer, track})
            surfaceControl.MouseDown += delegate(object sender, MouseEventArgs e) { if(e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero); KeepOnScreen(); } };
        Resize += delegate { RoundCorners(); };
        Shown += delegate { Arrange(); KeepOnScreen(); };
        FormClosing += delegate(object sender, FormClosingEventArgs e) { if(!quitting) { e.Cancel = true; back(); } };
        Arrange(); ApplyTheme();
        clock.Interval = 200; clock.Tick += delegate { RefreshTime(); }; clock.Start();
    }
    void Arrange()
    {
        SuspendLayout();
        float scale; using(var graphics = CreateGraphics()) scale = graphics.DpiX / 96f;
        int width = small ? 320 : 370, height = small ? 228 : 292;
        ClientSize = new Size((int)(width * scale), (int)(height * scale));
        Place(task, 16, 48, width-32, 24, scale);
        Place(pin, 16, 9, 96, 32, scale); Place(compact, width-146, 9, 62, 32, scale); Place(restore, width-78, 9, 62, 32, scale);
        Place(caption, 16, small ? 74 : 84, width-32, 20, scale);
        Place(digits, 16, small ? 94 : 106, width-32, small ? 54 : 74, scale);
        Place(status, 16, small ? 149 : 186, width-32, 22, scale);
        int y=small ? 175 : 218, gap=8, bw=(width-32-2*gap)/3;
        Place(pause,16,y,bw,40,scale);Place(add,16+bw+gap,y,bw,40,scale);Place(finish,16+2*(bw+gap),y,bw,40,scale);
        Place(footer,16,263,width-32,20,scale); footer.Visible=!small;
        Place(track,16,height-4,width-32,3,scale);
        footer.Text="F8 暂停 / 继续 · Esc 返回主界面";
        compact.Text=small?"展开":"紧凑"; compact.AccessibleName=small?"展开计时小窗":"切换紧凑小窗";
        ResumeLayout();RoundCorners();
    }
    static void Place(Control c,int x,int y,int w,int h,float scale) { c.SetBounds((int)(x*scale),(int)(y*scale),(int)(w*scale),(int)(h*scale)); }
    void Style(Button b,string text,bool primary)
    {
        b.Text=text;b.AccessibleName=text;b.FlatStyle=FlatStyle.Flat;b.UseVisualStyleBackColor=false;
        b.FlatAppearance.BorderSize=1;b.FlatAppearance.BorderColor=primary?ink:line;
        b.BackColor=primary?ink:surface;b.ForeColor=primary?surface:ink;b.Cursor=Cursors.Hand;
        b.FlatAppearance.MouseOverBackColor=primary?(dark?Color.FromArgb(212,212,212):Color.FromArgb(55,55,55)):soft;
    }
    void ApplyTheme()
    {
        surface=dark?Color.FromArgb(30,30,30):Color.FromArgb(250,250,250);
        ink=dark?Color.FromArgb(239,239,239):Color.FromArgb(31,31,31);
        muted=dark?Color.FromArgb(177,177,177):Color.FromArgb(100,100,100);
        line=dark?Color.FromArgb(70,70,70):Color.FromArgb(217,217,217);
        soft=dark?Color.FromArgb(48,48,48):Color.FromArgb(237,237,237);
        BackColor=surface;ForeColor=ink;task.ForeColor=digits.ForeColor=ink;status.ForeColor=caption.ForeColor=footer.ForeColor=muted;
        track.BackColor=soft;
        Style(pin,TopMost?"置顶中":"置顶",false);pin.BackColor=TopMost?soft:surface;pin.AccessibleName=TopMost?"取消置顶":"置顶";
        Style(compact,small?"展开":"紧凑",false);compact.AccessibleName=small?"展开计时小窗":"切换紧凑小窗";
        Style(restore,"返回",false);restore.AccessibleName="返回主界面";
        Style(pause,phase=="paused"?"继续":"暂停",true);Style(add,"+5 分钟",false);Style(finish,"结束记录",false);
        hints.SetToolTip(pin,TopMost?"已置顶，点击取消置顶":"点击使计时小窗保持在其他窗口上方");Invalidate(true);
    }
    void TogglePin(){TopMost=!TopMost;ApplyTheme();}
    void Send(string key)
    {
        if(pending!="" || phase=="ready" || phase=="ended")return;
        if(key=="pause"&&phase!="running" || key=="resume"&&phase!="paused" || key=="add5"&&mode!="down")return;
        pending=key;pendingAt=Now();RefreshTime();command(key);
    }
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if(keyData==Keys.Escape){back();return true;}
        if(keyData==Keys.F8){if(pause.Enabled)Send(phase=="paused"?"resume":"pause");return true;}
        if(keyData==(Keys.Control|Keys.Enter)){if(finish.Enabled)Send("end");return true;}
        return base.ProcessCmdKey(ref msg,keyData);
    }
    static double Now(){return (DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds;}
    static double Number(Dictionary<string,object> data,string key,double fallback)
    {
        object raw;double value;
        return data.TryGetValue(key,out raw)&&Double.TryParse(Convert.ToString(raw,CultureInfo.InvariantCulture),NumberStyles.Float,CultureInfo.InvariantCulture,out value)&&!Double.IsNaN(value)&&!Double.IsInfinity(value)&&value>=0?value:fallback;
    }
    internal void UpdateSnapshot(Dictionary<string,object> data)
    {
        object raw;phase=data.TryGetValue("phase",out raw)?Convert.ToString(raw):"ready";mode=data.TryGetValue("mode",out raw)?Convert.ToString(raw):"down";
        string title=data.TryGetValue("title",out raw)?Convert.ToString(raw):"";
        task.Text=title.Length>150?title.Substring(0,150):title;hints.SetToolTip(task,title+" · 拖动移动小窗");
        budget=Number(data,"budgetMs",0);elapsed=Number(data,"elapsedMs",0);receivedAt=Number(data,"at",Now());
        if(receivedAt>=pendingAt)pending="";
        bool nextDark=data.TryGetValue("dark",out raw)&&Convert.ToString(raw).ToLowerInvariant()=="true";
        if(dark!=nextDark){dark=nextDark;ApplyTheme();}
        error=data.TryGetValue("error",out raw)?Convert.ToString(raw):"";
        RefreshTime();
    }
    double ElapsedNow(){double value=elapsed+(phase=="running"?Math.Max(0,Now()-receivedAt):0);return mode=="down"?Math.Min(budget,value):value;}
    static string Format(double milliseconds){long seconds=(long)Math.Floor(milliseconds/1000+.5);return seconds>=3600?(seconds/3600)+":"+(seconds%3600/60).ToString("00")+":"+(seconds%60).ToString("00"):(seconds/60).ToString("00")+":"+(seconds%60).ToString("00");}
    void RefreshTime()
    {
        double value=ElapsedNow();bool due=phase=="due"||(phase=="running"&&mode=="down"&&value>=budget);
        if(pending!=""&&Now()-pendingAt>7000)pending="";
        digits.Text=Format(mode=="down"?Math.Max(0,budget-value):value);
        caption.Text=due?"时间到":phase=="paused"?"已暂停 · 不累计用时":mode=="up"?"正计时 · 已专注":"倒计时 · 剩余时间";
        status.Text=error!=""?"操作未保存，请返回主界面重试":pending!=""?"正在同步操作…":due?"结束记录，或再给自己 5 分钟":phase=="paused"?"准备好后，点继续":"已专注 "+Format(value);
        pause.Text=phase=="paused"?"继续":"暂停";pause.AccessibleName=pause.Text;
        pause.Enabled=pending==""&&!due&&(phase=="running"||phase=="paused");
        add.Enabled=pending==""&&mode=="down"&&phase!="ready"&&phase!="ended";
        finish.Enabled=pending==""&&phase!="ready"&&phase!="ended";finish.AccessibleName="结束并记录";
        track.Invalidate();
    }
    internal void KeepOnScreen(){Rectangle area=Screen.FromPoint(Location).WorkingArea;Location=new Point(Math.Max(area.Left,Math.Min(Left,area.Right-Width)),Math.Max(area.Top,Math.Min(Top,area.Bottom-Height)));}
    static GraphicsPath Rounded(Rectangle r,int radius){int d=radius*2;var p=new GraphicsPath();p.AddArc(r.Left,r.Top,d,d,180,90);p.AddArc(r.Right-d,r.Top,d,d,270,90);p.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);p.AddArc(r.Left,r.Bottom-d,d,d,90,90);p.CloseFigure();return p;}
    void RoundCorners(){if(ClientSize.Width<40)return;using(var p=Rounded(ClientRectangle,12)){var old=Region;Region=new Region(p);if(old!=null)old.Dispose();}}
    protected override void OnPaint(PaintEventArgs e){base.OnPaint(e);e.Graphics.SmoothingMode=SmoothingMode.AntiAlias;using(var p=Rounded(new Rectangle(0,0,Width-1,Height-1),12))using(var pen=new Pen(line))e.Graphics.DrawPath(pen,p);}
    internal void ShutDown(){quitting=true;clock.Stop();clock.Dispose();hints.Dispose();Close();Dispose();}
}

internal sealed class TimerDigits : Label
{
    protected override void OnPaint(PaintEventArgs e)
    {
        const TextFormatFlags flags = TextFormatFlags.SingleLine | TextFormatFlags.NoPadding | TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter;
        float pixels = ClientSize.Height * .86f;
        while(pixels >= 12) {
            using(var font = new Font("Consolas", pixels, FontStyle.Bold, GraphicsUnit.Pixel)) {
                if(TextRenderer.MeasureText(e.Graphics, Text, font, new Size(Int32.MaxValue, Int32.MaxValue), TextFormatFlags.SingleLine | TextFormatFlags.NoPadding).Width <= ClientSize.Width) {
                    TextRenderer.DrawText(e.Graphics, Text, font, ClientRectangle, ForeColor, BackColor, flags); return;
                }
            }
            pixels -= 1;
        }
    }
}
