using System;
using System.Drawing;
using System.Windows.Forms;
using System.Collections.Generic;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

// A real, non-owned topmost native window: stays visible when the main form is minimized.
internal sealed class TimerMiniWindow : Form
{
    private readonly Label task = new Label(), digits = new TimerDigits(), status = new Label();
    private readonly Button pause = new Button(), restore = new Button();
    private readonly Panel track = new Panel();
    private readonly Timer clock = new Timer();
    private readonly Action returnToBoard;
    private readonly Action<string> control;
    private string phase = "ready";
    private double remaining = 1500000, budget = 1500000, cutoff, receivedAt;
    private bool quitting;
    private readonly ToolTip hints = new ToolTip();
    [DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr handle, int message, IntPtr w, IntPtr l);

    internal TimerMiniWindow(Action back, Action<string> command)
    {
        returnToBoard = back; control = command;
        Text = "T计划 · 悬浮计时"; Name = "TPlanFloatingTimer";
        AccessibleName = "T计划悬浮计时器";
        FormBorderStyle = FormBorderStyle.None;
        TopMost = true; ShowInTaskbar = false; MaximizeBox = false; MinimizeBox = false;
        AutoScaleMode = AutoScaleMode.Dpi; ClientSize = new Size(240, 114);
        DoubleBuffered = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = Color.FromArgb(250, 249, 245);
        Font = new Font("Microsoft YaHei UI", 9);
        ForeColor = Color.FromArgb(31, 30, 29);
        task.SetBounds(14, 10, 184, 18); task.AutoEllipsis = true;
        task.Font = new Font("Microsoft YaHei UI", 8); task.ForeColor = Color.FromArgb(94, 93, 89);
        task.Text = "先为这一轮设定一个目标"; task.AccessibleName = "当前任务";
        digits.SetBounds(12, 28, 166, 55); digits.TextAlign = ContentAlignment.MiddleLeft;
        digits.Font = new Font("Consolas", 32, FontStyle.Bold); digits.Text = "25:00"; digits.Name = "MiniClock";
        status.SetBounds(15, 84, 211, 18); status.TextAlign = ContentAlignment.MiddleLeft;
        status.Font = new Font("Microsoft YaHei UI", 8);
        status.ForeColor = Color.FromArgb(111, 109, 102); status.Name = "MiniStatus";
        track.SetBounds(15, 105, 210, 3); track.BackColor = Color.FromArgb(230, 227, 217);
        track.Paint += delegate(object sender, PaintEventArgs e) {
            double left = LeftMilliseconds();
            using (SolidBrush brush = new SolidBrush(Color.FromArgb(201, 100, 66)))
                e.Graphics.FillRectangle(brush, 0, 0, (float)(track.Width * Math.Max(0, Math.Min(1, left / Math.Max(1, budget)))), track.Height);
        };
        pause.SetBounds(184, 40, 40, 35); pause.Text = "Ⅱ"; pause.Name = "MiniPause";
        pause.Font = new Font("Segoe UI Symbol", 19, FontStyle.Bold, GraphicsUnit.Pixel);
        pause.FlatStyle = FlatStyle.Flat; pause.FlatAppearance.BorderSize = 0;
        pause.BackColor = Color.FromArgb(174, 83, 50); pause.ForeColor = Color.White;
        pause.Click += delegate { if (phase == "running" || phase == "paused") control(phase == "paused" ? "resume" : "pause"); else returnToBoard(); };
        restore.SetBounds(204, 6, 26, 24); restore.Text = "↗"; restore.Name = "MiniRestore";
        restore.AccessibleName = "返回看板"; restore.Font = new Font("Segoe UI Symbol", 16, FontStyle.Regular, GraphicsUnit.Pixel);
        restore.FlatStyle = FlatStyle.Flat; restore.FlatAppearance.BorderSize = 0;
        restore.BackColor = BackColor; restore.ForeColor = Color.FromArgb(94, 93, 89); restore.Click += delegate { returnToBoard(); };
        Controls.AddRange(new Control[] { task, digits, status, track, pause, restore });
        hints.SetToolTip(restore, "返回任务计时看板");
        foreach (Control surface in new Control[] { this, task, digits, status, track })
            surface.MouseDown += delegate(object sender, MouseEventArgs e) { if (e.Button == MouseButtons.Left) { ReleaseCapture(); SendMessage(Handle, 0xA1, new IntPtr(2), IntPtr.Zero); } };
        Resize += delegate { RoundCorners(); };
        RoundCorners();
        // Closing this window means return to the app, never accidentally terminate the timer.
        FormClosing += delegate(object sender, FormClosingEventArgs e) { if (!quitting) { e.Cancel = true; returnToBoard(); } };
        clock.Interval = 250; clock.Tick += delegate { RefreshTime(); }; clock.Start();
        Shown += delegate { KeepOnScreen(); };
    }

    private static double Now() { return (DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalMilliseconds; }
    private static double ReadNumber(Dictionary<string, object> value, string key, double fallback)
    {
        object raw; double number;
        return value.TryGetValue(key, out raw) && Double.TryParse(Convert.ToString(raw, System.Globalization.CultureInfo.InvariantCulture), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out number) && !Double.IsNaN(number) && !Double.IsInfinity(number) && number >= 0 ? number : fallback;
    }
    internal void UpdateSnapshot(Dictionary<string, object> data)
    {
        object raw; string next = data.TryGetValue("phase", out raw) ? raw as string : null;
        if (next != "ready" && next != "running" && next != "paused" && next != "review") return;
        phase = next;
        string title = data.TryGetValue("title", out raw) ? raw as string : null;
        task.Text = String.IsNullOrWhiteSpace(title) ? "先为这一轮设定一个目标" : title.Substring(0, Math.Min(150, title.Length));
        hints.SetToolTip(task, task.Text);
        remaining = Math.Min(10800000, ReadNumber(data, "remainingMs", 1500000));
        budget = Math.Max(1, Math.Min(10800000, ReadNumber(data, "budgetMs", 1500000)));
        cutoff = ReadNumber(data, "cutoff", 0); receivedAt = ReadNumber(data, "at", Now());
        RefreshTime();
    }
    private double LeftMilliseconds()
    {
        if (phase == "review") return 0;
        if (phase == "ready") return remaining;
        double untilCutoff = Math.Max(0, cutoff - Now());
        if (untilCutoff <= 0) return 0;
        return phase == "running" ? Math.Max(0, Math.Min(untilCutoff, remaining - Math.Max(0, Now() - receivedAt))) : remaining;
    }
    private void RefreshTime()
    {
        double left = LeftMilliseconds();
        bool due = phase == "review" || (phase != "ready" && (Now() >= cutoff || (phase == "running" && left <= 0)));
        int seconds = (int)Math.Ceiling(left / 1000);
        digits.Text = (seconds / 60).ToString("00") + ":" + (seconds % 60).ToString("00");
        bool cutoffFirst = phase == "running" && cutoff - Now() < remaining - Math.Max(0, Now() - receivedAt);
        string end = cutoff > 0 && cutoff < 253402300799999 ? new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddMilliseconds(cutoff).ToLocalTime().ToString("HH:mm") : "";
        status.Text = due ? "本轮到点 · 请收尾" : phase == "running" ? (cutoffFirst ? "底线先到 · " + end + " 收尾" : "专注中") : phase == "paused" ? "已暂停 · " + end + " 收尾" : "准备开始";
        pause.Text = due ? "↗" : phase == "paused" ? "▶" : phase == "running" ? "Ⅱ" : "▶";
        pause.AccessibleName = due ? "去收尾" : phase == "paused" ? "继续" : phase == "running" ? "暂停" : "去开始";
        hints.SetToolTip(pause, pause.AccessibleName);
        if (due) phase = "review";
        track.Invalidate();
    }
    internal void KeepOnScreen()
    {
        Rectangle area = Screen.FromPoint(Location).WorkingArea;
        Location = new Point(Math.Max(area.Left, Math.Min(Left, area.Right - Width)), Math.Max(area.Top, Math.Min(Top, area.Bottom - Height)));
    }
    private static GraphicsPath Rounded(Rectangle bounds, int radius)
    {
        GraphicsPath path = new GraphicsPath(); int d = radius * 2;
        path.AddArc(bounds.Left, bounds.Top, d, d, 180, 90); path.AddArc(bounds.Right-d, bounds.Top, d, d, 270, 90);
        path.AddArc(bounds.Right-d, bounds.Bottom-d, d, d, 0, 90); path.AddArc(bounds.Left, bounds.Bottom-d, d, d, 90, 90); path.CloseFigure(); return path;
    }
    private void RoundCorners()
    {
        if (ClientSize.Width < 40 || ClientSize.Height < 40) return;
        using (GraphicsPath path = Rounded(ClientRectangle, 16)) { Region old = Region; Region = new Region(path); if (old != null) old.Dispose(); }
        using (GraphicsPath path = Rounded(pause.ClientRectangle, 10)) { Region old = pause.Region; pause.Region = new Region(path); if (old != null) old.Dispose(); }
    }
    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e); e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using (GraphicsPath path = Rounded(new Rectangle(0, 0, Width-1, Height-1), 16))
        using (Pen border = new Pen(Color.FromArgb(214, 210, 196))) e.Graphics.DrawPath(border, path);
    }
    internal void ShutDown() { quitting = true; clock.Stop(); clock.Dispose(); hints.Dispose(); Close(); Dispose(); }
}

// Measure in the actual window DPI, never wrap a countdown onto another line.
internal sealed class TimerDigits : Label
{
    protected override void OnPaint(PaintEventArgs e)
    {
        const TextFormatFlags flags = TextFormatFlags.SingleLine | TextFormatFlags.NoPadding | TextFormatFlags.VerticalCenter | TextFormatFlags.Left;
        float pixels = Math.Min(44, ClientSize.Height * 0.78f);
        while (pixels >= 12)
        {
            using (Font fitted = new Font("Consolas", pixels, FontStyle.Bold, GraphicsUnit.Pixel))
            {
                Size size = TextRenderer.MeasureText(e.Graphics, Text, fitted, new Size(Int32.MaxValue, Int32.MaxValue), TextFormatFlags.SingleLine | TextFormatFlags.NoPadding);
                if (size.Width <= ClientSize.Width && size.Height <= ClientSize.Height)
                { TextRenderer.DrawText(e.Graphics, Text, fitted, ClientRectangle, ForeColor, BackColor, flags); return; }
            }
            pixels -= 1;
        }
    }
}
