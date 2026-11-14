param([switch]$SkipRuntimeCopy,[string]$OutputDirectory='out\TPlan-win-x64',[switch]$Candidate)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$packageRoot = Join-Path $PSScriptRoot $OutputDirectory
$sdkRoot = Join-Path $PSScriptRoot 'vendor\sdk'
$runtimeRoot = Join-Path $PSScriptRoot 'vendor\runtime\Microsoft.WebView2.FixedVersionRuntime.152.0.4191.62.x64'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$nodePath = 'C:\Users\fanzi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (Get-Command node -ErrorAction SilentlyContinue) { $nodePath = (Get-Command node).Source }
foreach ($inputPath in @($compiler,$nodePath,(Join-Path $sdkRoot 'lib\net462\Microsoft.Web.WebView2.Core.dll'),(Join-Path $runtimeRoot 'msedgewebview2.exe'))) {
    if (-not (Test-Path -LiteralPath $inputPath)) { throw "Missing build input: $inputPath" }
}
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'licenses') -Force | Out-Null
& $nodePath (Join-Path $projectRoot 'build-standalone.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Standalone HTML build failed' }
& (Join-Path $PSScriptRoot 'convert-icon.ps1')
$compilerArgs = @('/nologo','/target:winexe','/platform:x64','/optimize+','/utf8output',
    ('/out:' + (Join-Path $packageRoot 'T计划.exe')),
    ('/win32manifest:' + (Join-Path $PSScriptRoot 'app.manifest')),
    ('/win32icon:' + (Join-Path $projectRoot 'assets\tplan.ico')),
    ('/resource:' + (Join-Path $projectRoot 'T计划_V1.3_单文件.html') + ',TPlan.index.html'),
    ('/resource:' + (Join-Path $projectRoot 'assets\tplan.ico') + ',TPlan.icon.ico'),
    '/reference:System.Net.Http.dll','/reference:System.Security.dll','/reference:System.dll','/reference:System.Core.dll','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.Web.Extensions.dll',
    ('/reference:' + (Join-Path $sdkRoot 'lib\net462\Microsoft.Web.WebView2.Core.dll')),
    ('/reference:' + (Join-Path $sdkRoot 'lib\net462\Microsoft.Web.WebView2.WinForms.dll')),
    (Join-Path $PSScriptRoot 'TPlan.cs'),(Join-Path $PSScriptRoot 'TimerMiniWindow.cs'),(Join-Path $PSScriptRoot 'AiTaskService.cs'))
if($Candidate) { $compilerArgs += '/define:TPLAN_CANDIDATE' }
& $compiler @compilerArgs
if ($LASTEXITCODE -ne 0) { throw 'Native executable compilation failed' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'TPlan.exe.config') -Destination (Join-Path $packageRoot 'T计划.exe.config') -Force
foreach ($dll in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')) {
    Copy-Item -LiteralPath (Join-Path $sdkRoot ('lib\net462\' + $dll)) -Destination $packageRoot -Force
}
Copy-Item -LiteralPath (Join-Path $sdkRoot 'runtimes\win-x64\native\WebView2Loader.dll') -Destination $packageRoot -Force
Copy-Item -LiteralPath (Join-Path $sdkRoot 'LICENSE.txt') -Destination (Join-Path $packageRoot 'licenses\WebView2-SDK-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $sdkRoot 'NOTICE.txt') -Destination (Join-Path $packageRoot 'licenses\WebView2-SDK-NOTICE.txt') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'vendor\WebView2-Fixed-Runtime-LICENSE.html') -Destination (Join-Path $packageRoot 'licenses\WebView2-Fixed-Runtime-LICENSE.html') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'assets\licenses\LogicFlow-and-dependencies.txt') -Destination (Join-Path $packageRoot 'licenses') -Force
$licenseHtml = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'vendor\WebView2-Fixed-Runtime-LICENSE.html'))
$licenseText = [Net.WebUtility]::HtmlDecode(($licenseHtml -replace '<[^>]+>',''))
$licenseText = (($licenseText -replace '[\t ]+',' ') -replace '(\r?\n){3,}',"`r`n`r`n").Trim()
[IO.File]::WriteAllText((Join-Path $packageRoot 'licenses\WebView2-Fixed-Runtime-LICENSE.txt'),$licenseText,(New-Object Text.UTF8Encoding($true)))
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '使用说明.txt')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot '使用说明.txt') -Destination $packageRoot -Force }
if (-not $SkipRuntimeCopy) {
    $runtimeOutput = Join-Path $packageRoot 'runtime'
    # No deletion or mirroring: the exact redistributable input is copied to our package only.
    & robocopy $runtimeRoot $runtimeOutput /E /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -ge 8) { throw 'Fixed runtime copy failed' }
    & icacls $runtimeOutput /grant '*S-1-15-2-1:(OI)(CI)(RX)' '*S-1-15-2-2:(OI)(CI)(RX)' /T /Q | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fixed runtime read/execute ACL setup failed' }
}
$runtimeOutput = Join-Path $packageRoot 'runtime'
$runtimeInputs = @(Get-ChildItem -LiteralPath $runtimeRoot -Recurse -File)
$runtimeOutputs = @(Get-ChildItem -LiteralPath $runtimeOutput -Recurse -File -ErrorAction Stop)
if ($runtimeInputs.Count -ne $runtimeOutputs.Count) { throw 'Fixed runtime package file count mismatch; run without -SkipRuntimeCopy' }
foreach ($runtimeInput in $runtimeInputs) {
    $relativeName = $runtimeInput.FullName.Substring($runtimeRoot.Length + 1)
    $packagedFile = Join-Path $runtimeOutput $relativeName
    if (-not (Test-Path -LiteralPath $packagedFile -PathType Leaf)) { throw "Incomplete runtime: $relativeName" }
    if ((Get-Item -LiteralPath $packagedFile).Length -ne $runtimeInput.Length) { throw "Runtime size mismatch: $relativeName" }
}
if ((Get-Item -LiteralPath (Join-Path $runtimeOutput 'msedgewebview2.exe')).VersionInfo.FileVersion -ne '152.0.4191.62') { throw 'Wrong Fixed Runtime version' }
Write-Output ('Built native Windows x64 package: ' + $packageRoot)
exit 0
