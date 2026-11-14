param([int]$CandidatePid,[ValidateSet('restore','minimize')][string]$Action='restore')
$ErrorActionPreference='Stop'
$candidateRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../desktop/out/TPlan-1.8.0-candidate2'))
$process=Get-Process -Id $CandidatePid
if(-not $process.Path.StartsWith($candidateRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing to operate a non-candidate process'}
Add-Type 'using System;using System.Runtime.InteropServices;public class QaWindow{[DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr h,int c);}'
[QaWindow]::ShowWindow($process.MainWindowHandle,$(if($Action -eq 'restore'){9}else{6}))|Out-Null
