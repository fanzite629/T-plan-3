param([int]$CandidatePid)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
Add-Type 'using System;using System.Runtime.InteropServices;public class SettingsProbe{[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr h);[DllImport("user32.dll")]public static extern int GetWindowLong(IntPtr h,int n);[DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);}'
$main=[Windows.Automation.AutomationElement]::FromHandle((Get-Process -Id $CandidatePid).MainWindowHandle)
$all=$main.FindAll([Windows.Automation.TreeScope]::Subtree,[Windows.Automation.Condition]::TrueCondition)
$window=@($all|Where-Object{$_.Current.ProcessId -eq $CandidatePid -and $_.Current.Name -eq 'T计划 · DeepSeek 安全设置'})|Select-Object -First 1
if(-not $window){throw 'Native settings window not found'}
$controls=@($window.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition))
$secret=@($controls|Where-Object{$_.Current.ClassName -like 'WindowsForms10.EDIT.*' -and ([SettingsProbe]::GetWindowLong([IntPtr]$_.Current.NativeWindowHandle,-16) -band 0x20) -ne 0})
if($secret.Count -ne 1){throw 'Expected one masked native credential input'}
if($secret[0].Current.IsEnabled){throw 'QA mode must disable credential input'}
$save=$controls|Where-Object{$_.Current.Name -eq '保存配置'}|Select-Object -First 1
if($save.Current.IsEnabled){throw 'QA mode must not save credentials'}
[SettingsProbe]::SetForegroundWindow([IntPtr]$window.Current.NativeWindowHandle)|Out-Null
Start-Sleep -Milliseconds 300
$r=$window.Current.BoundingRectangle;$bitmap=[Drawing.Bitmap]::new([int]$r.Width,[int]$r.Height);$g=[Drawing.Graphics]::FromImage($bitmap)
try{$dc=$g.GetHdc();try{if(-not [SettingsProbe]::PrintWindow([IntPtr]$window.Current.NativeWindowHandle,$dc,2)){throw 'Native window capture failed'}}finally{$g.ReleaseHdc($dc)};$bitmap.Save((Join-Path $PSScriptRoot '../output/playwright/task-map/native-settings.png'),[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose()}
([Windows.Automation.WindowPattern]$window.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern)).Close()
[pscustomobject]@{status='PASS';nativeMaskedInput=$true;qaKeyEntryDisabled=$true;qaSaveDisabled=$true;keyValueRead=$false}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot '../output/playwright/task-map/native-settings-results.json') -Encoding UTF8
Write-Output 'PASS actual native settings window; masked key field; QA save disabled; no key value read'
