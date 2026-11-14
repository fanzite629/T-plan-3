$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$packageRoot = Join-Path $PSScriptRoot 'out\TPlan-1.9.1-release'
$releaseRoot = Join-Path $projectRoot 'releases'
New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
$allowedTop = @('T计划.exe','T计划.exe.config','Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll','WebView2Loader.dll','runtime','licenses','使用说明.txt')
foreach ($entry in Get-ChildItem -LiteralPath $packageRoot -Force) {
    if ($entry.Name -notin $allowedTop) { throw ('Unexpected release content: ' + $entry.Name) }
}
foreach ($name in $allowedTop) { if (-not (Test-Path -LiteralPath (Join-Path $packageRoot $name))) { throw ('Missing release content: ' + $name) } }
$zipPath = Join-Path $releaseRoot 'T计划_1.9.1_Windows_x64_便携版.zip'
if (Test-Path -LiteralPath $zipPath) { throw 'The portable archive already exists. Preserve the prior candidate before rebuilding.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($packageRoot,$zipPath,[IO.Compression.CompressionLevel]::Optimal,$true)
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $files = @($archive.Entries | Where-Object { -not $_.FullName.EndsWith('/') })
    $sourceFiles = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File)
    if ($files.Count -ne $sourceFiles.Count) { throw 'ZIP/source file count mismatch' }
    $inventory = foreach ($file in $sourceFiles) {
        [ordered]@{path=$file.FullName.Substring($packageRoot.Length+1).Replace('\','/');bytes=$file.Length;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}
    }
    $inventory | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $releaseRoot 'package-manifest-1.9.1.json') -Encoding UTF8
} finally { $archive.Dispose() }
Get-Item -LiteralPath $zipPath | Select-Object Name,Length
Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
