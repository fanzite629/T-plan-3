param(
    [string]$Destination = 'D:\Soft\TPlanV3',
    [string]$SourceHtml = 'C:\Users\fanzi\Downloads\T计划_v3 (2).html',
    [string]$IconSource = (Join-Path $PSScriptRoot 'icon.ico')
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
if (Test-Path -LiteralPath $Destination) { throw "目标目录已存在，请先检查：$Destination" }
if ((Get-FileHash -LiteralPath $SourceHtml).Hash -ne (Get-FileHash -LiteralPath (Join-Path $root 'original.html')).Hash) {
    throw 'HTML 源文件已变化，需要重新生成桌面页面。'
}
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop 'T计划 v3.lnk'
if (Test-Path -LiteralPath $shortcutPath) { throw '桌面快捷方式已存在，请先检查。' }
New-Item -ItemType Directory -Path $Destination | Out-Null

# Use the warm orange icon matching the v3 application's theme.
$iconPath = Join-Path $Destination 'TPlan-orange-sprout.ico'
Copy-Item -LiteralPath $IconSource -Destination $iconPath

$package = Join-Path $root 'package'
& robocopy $package $Destination /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XF 'T计划 v3.exe' '使用说明.txt'
if ($LASTEXITCODE -ge 8) { throw '运行组件复制失败。' }
$sdk = Join-Path $root '..\desktop\vendor\sdk'
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$exe = Join-Path $Destination 'T计划 v3.exe'
& $csc /nologo /target:winexe /platform:x64 /utf8output "/out:$exe" "/win32icon:$iconPath" "/win32manifest:$root\..\desktop\app.manifest" "/resource:$root\index.html,index" "/resource:$iconPath,icon" /reference:System.dll /reference:System.Core.dll /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Security.dll /reference:System.Web.Extensions.dll /reference:System.Net.Http.dll "/reference:$sdk\lib\net462\Microsoft.Web.WebView2.Core.dll" "/reference:$sdk\lib\net462\Microsoft.Web.WebView2.WinForms.dll" "$root\App.cs" "$root\MainWindow.cs" "$root\TimerMiniWindow.cs" "$root\AiGateway.cs"
if ($LASTEXITCODE -ne 0) { throw '编译失败。' }
$readme = @'
T计划 v3 · 本机桌面版

启动：双击桌面的“T计划 v3”，或此目录中的“T计划 v3.exe”。
软件位置：D:\Soft\TPlanV3。请保留整个目录，EXE 依赖同目录的 runtime 和 DLL。
图标：保留 T 和双叶造型，改为暖橙色，与 v3 界面主题一致。
数据：%LOCALAPPDATA%\TPlanV3\tplan.sqlite3，与原版 T计划 数据独立。
备份：在“数据与设置”中导出 JSON；完整备份请关闭软件后复制整个数据目录。
基本计划、计时、课表功能可离线使用，在线 AI 需自行配置接口和密钥。
本版本为空白任务起步，保留源 HTML 的内置课表。
移除软件：关闭软件后删除本软件目录及桌面快捷方式即可，数据目录会保留。
'@
[IO.File]::WriteAllText((Join-Path $Destination '使用说明.txt'), $readme, (New-Object Text.UTF8Encoding($true)))
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = $Destination
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Description = 'T计划 v3 · 本地计划与专注计时'
$shortcut.Save()
$receipt = [ordered]@{
    installedAt = [DateTimeOffset]::Now.ToString('o')
    destination = $Destination
    shortcut = $shortcutPath
    sourceHtml = $SourceHtml
    sourceSha256 = (Get-FileHash -LiteralPath $SourceHtml).Hash
    iconSource = $IconSource
    iconSha256 = (Get-FileHash -LiteralPath $iconPath).Hash
    exeSha256 = (Get-FileHash -LiteralPath $exe).Hash
    dataDirectory = (Join-Path $env:LOCALAPPDATA 'TPlanV3')
}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Destination 'installation.json') -Encoding UTF8
$receipt | ConvertTo-Json
