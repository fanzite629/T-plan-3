$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$package = Join-Path $PSScriptRoot 'desktop-evidence\diagnostic-package'
New-Item -ItemType Directory -Path $package -Force | Out-Null
& robocopy (Join-Path $project 'desktop\out\TPlan-win-x64') $package /E /COPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if($LASTEXITCODE -ge 8){throw 'Diagnostic copy failed'}
$source = [IO.File]::ReadAllText((Join-Path $project 'desktop\TPlan.cs'))
$source = $source.Replace('private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)', 'private void TraceNative(string value) { try { File.AppendAllText(Path.Combine(dataRoot, "native-debug.log"), DateTime.UtcNow.ToString("o") + " " + value + Environment.NewLine); } catch {} }' + [Environment]::NewLine + '    private void OnDownloadStarting(object sender, CoreWebView2DownloadStartingEventArgs e)')
$source = $source.Replace('e.Handled = true;' + [char]10 + '        if (!e.DownloadOperation.Uri', 'TraceNative("DownloadStarting " + e.DownloadOperation.Uri);' + [char]10 + '        e.DownloadOperation.StateChanged += delegate { TraceNative("DownloadState " + e.DownloadOperation.State.ToString() + " " + e.DownloadOperation.InterruptReason.ToString()); };' + [char]10 + '        e.Handled = true;' + [char]10 + '        if (!e.DownloadOperation.Uri')
$source = $source.Replace('if (picker.ShowDialog(this) != DialogResult.OK) e.Cancel = true;', 'if (picker.ShowDialog(this) != DialogResult.OK) { TraceNative("Picker cancelled"); e.Cancel = true; }')
$source = $source.Replace('else e.ResultFilePath = picker.FileName;', 'else { e.ResultFilePath = picker.FileName; TraceNative("Selected=" + picker.FileName + " Result=" + e.ResultFilePath); }')
$source = $source.Replace('if (e.Request.Uri == AppUrl', 'TraceNative("Resource " + e.Request.Method + " " + e.Request.Uri);' + [char]10 + '                if (e.Request.Uri == AppUrl')
$diagnosticSource = Join-Path $PSScriptRoot 'desktop-evidence\TPlan.diagnostic.cs'
[IO.File]::WriteAllText($diagnosticSource,$source,(New-Object Text.UTF8Encoding($true)))
$sdk = Join-Path $project 'desktop\vendor\sdk\lib\net462'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$args = @('/nologo','/target:winexe','/platform:x64','/optimize+',('/out:'+(Join-Path $package 'T计划.exe')),('/win32manifest:'+(Join-Path $project 'desktop\app.manifest')),('/resource:'+(Join-Path $project 'T计划_V1.3_单文件.html')+',TPlan.index.html'),('/resource:'+(Join-Path $project 'assets\tplan.ico')+',TPlan.icon.ico'),'/reference:System.dll','/reference:System.Core.dll','/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll',('/reference:'+(Join-Path $sdk 'Microsoft.Web.WebView2.Core.dll')),('/reference:'+(Join-Path $sdk 'Microsoft.Web.WebView2.WinForms.dll')),$diagnosticSource)
& $compiler @args
if($LASTEXITCODE -ne 0){throw 'Diagnostic compilation failed'}
Write-Output (Join-Path $package 'T计划.exe')
