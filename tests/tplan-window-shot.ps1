param([Parameter(Mandatory=$true)][int]$TPlanPid,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class TPlanWindowCapture {
 [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr handle,out Rect rect);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr handle,IntPtr hdc,uint flags);
}
'@
$proc=Get-Process -Id $TPlanPid
if($proc.ProcessName -ne 'T计划' -or $proc.MainWindowTitle -notmatch '^T计划'){throw 'Only owned TPlan application window may be captured'}
$rect=[TPlanWindowCapture+Rect]::new()
if(-not [TPlanWindowCapture]::GetWindowRect($proc.MainWindowHandle,[ref]$rect)){throw 'Window rectangle unavailable'}
$bitmap=[Drawing.Bitmap]::new($rect.Right-$rect.Left,$rect.Bottom-$rect.Top)
$graphics=[Drawing.Graphics]::FromImage($bitmap)
$hdc=$graphics.GetHdc()
try{$ok=[TPlanWindowCapture]::PrintWindow($proc.MainWindowHandle,$hdc,2)}finally{$graphics.ReleaseHdc($hdc)}
try{if(-not $ok){throw 'Owned window PrintWindow failed'};$bitmap.Save([IO.Path]::GetFullPath($OutputPath),[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}
