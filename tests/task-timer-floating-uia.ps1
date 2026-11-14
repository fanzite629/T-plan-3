param([int]$TPlanPid,[ValidateSet('inspect','pause','restore','close')][string]$Action='inspect',[string]$Screenshot='',[int]$CoverPid=0)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Console]::OutputEncoding
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
Add-Type @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public static class TimerWindowProbe {
 public delegate bool Callback(IntPtr h, IntPtr p);
 [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb, IntPtr p);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder t,int n);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h,int index);
 [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h,int message,IntPtr w,IntPtr l);
 [DllImport("user32.dll")] public static extern IntPtr GetTopWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h,uint cmd);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 public static IntPtr[] Windows(int pid) {var list=new List<IntPtr>();EnumWindows(delegate(IntPtr h,IntPtr p){uint found;GetWindowThreadProcessId(h,out found);if(found==pid)list.Add(h);return true;},IntPtr.Zero);return list.ToArray();}
 public static string Title(IntPtr h) {var b=new StringBuilder(256);GetWindowText(h,b,b.Capacity);return b.ToString();}
}
'@
$windows=@([TimerWindowProbe]::Windows($TPlanPid))
$mini=$windows | Where-Object {[TimerWindowProbe]::Title($_) -eq 'T计划 · 悬浮计时'} | Select-Object -First 1
if(-not $mini){throw 'Floating timer window not found'}
$main=$windows | Where-Object {$_ -ne $mini -and [TimerWindowProbe]::Title($_).Contains('T计划')} | Select-Object -First 1
$root=[System.Windows.Automation.AutomationElement]::FromHandle($mini)
function Find-Control([string]$id){$match=@{MiniClock='^\d{2,3}:\d{2}$';MiniStatus='^(专注中|已暂停|本轮到点|准备就绪|准备开始|底线先到)';MiniPause='^(暂停|继续|去收尾|去开始|Ⅱ|▶|↗)$';MiniRestore='^(返回看板|↗)$'}[$id];$found=@($root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)|Where-Object {$_.Current.Name -match $match});if($id -eq 'MiniPause'){return $found|Sort-Object {$_.Current.BoundingRectangle.Top} -Descending|Select-Object -First 1};return $found|Sort-Object {$_.Current.BoundingRectangle.Top}|Select-Object -First 1}
if($Action -eq 'pause' -or $Action -eq 'restore'){$id=if($Action -eq 'pause'){'MiniPause'}else{'MiniRestore'};$control=Find-Control $id;if(-not $control){throw "Control missing: $id"};$pattern=$null;if($control.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern,[ref]$pattern)){$pattern.Invoke()}else{[TimerWindowProbe]::PostMessage([IntPtr]$control.Current.NativeWindowHandle,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null};Start-Sleep -Milliseconds 800}
if($Action -eq 'close'){[TimerWindowProbe]::PostMessage($mini,0x10,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null;Start-Sleep -Milliseconds 500}
$clock=Find-Control 'MiniClock';$status=Find-Control 'MiniStatus';$rect=$root.Current.BoundingRectangle
if($Screenshot){$bitmap=New-Object Drawing.Bitmap([int]$rect.Width),([int]$rect.Height);$g=[Drawing.Graphics]::FromImage($bitmap);try{$g.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bitmap.Size);$bitmap.Save($Screenshot,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose()}}
$aboveCover=$null
if($CoverPid){$cover=[TimerWindowProbe]::Windows($CoverPid)|Where-Object {[TimerWindowProbe]::IsWindowVisible($_)}|Select-Object -First 1;if(-not $cover){throw 'Other application window not visible'};[TimerWindowProbe]::SetForegroundWindow($cover)|Out-Null;Start-Sleep -Milliseconds 400;$handle=[TimerWindowProbe]::GetTopWindow([IntPtr]::Zero);while($handle -ne [IntPtr]::Zero){if($handle -eq $mini){$aboveCover=$true;break};if($handle -eq $cover){$aboveCover=$false;break};$handle=[TimerWindowProbe]::GetWindow($handle,2)}}
[pscustomobject]@{MiniVisible=[TimerWindowProbe]::IsWindowVisible($mini);Topmost=([TimerWindowProbe]::GetWindowLong($mini,-20) -band 8) -ne 0;MainMinimized=[TimerWindowProbe]::IsIconic($main);Clock=$clock.Current.Name;Status=$status.Current.Name;AboveOtherApp=$aboveCover;Bounds=@($rect.X,$rect.Y,$rect.Width,$rect.Height)} | ConvertTo-Json -Compress
