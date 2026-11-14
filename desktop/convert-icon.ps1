$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
$source = [System.Drawing.Image]::FromFile((Join-Path $assetDir 'tplan-icon-source.png'))
try {
    $frames = @()
    foreach ($size in @(16,32,48,64,128,256)) {
        $bitmap = New-Object System.Drawing.Bitmap($size,$size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CompositingQuality = 'HighQuality'
        $graphics.InterpolationMode = 'HighQualityBicubic'
        $graphics.SmoothingMode = 'HighQuality'
        $graphics.DrawImage($source,0,0,$size,$size)
        $stream = New-Object System.IO.MemoryStream
        $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
        $frames += ,($stream.ToArray())
        if ($size -eq 128) { [IO.File]::WriteAllBytes((Join-Path $assetDir 'tplan-icon-128.png'),$stream.ToArray()) }
        $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
    }
    $icon = [IO.File]::Create((Join-Path $assetDir 'tplan.ico'))
    $writer = New-Object IO.BinaryWriter($icon)
    try {
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]6)
        $offset = 6 + 16 * 6
        $sizes = @(16,32,48,64,128,0)
        for ($i=0; $i -lt 6; $i++) {
            $writer.Write([byte]$sizes[$i]); $writer.Write([byte]$sizes[$i]); $writer.Write([byte]0); $writer.Write([byte]0)
            $writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
            $offset += $frames[$i].Length
        }
        foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
    } finally { $writer.Dispose(); $icon.Dispose() }
} finally { $source.Dispose() }
Write-Output 'Converted generated PNG to six Windows ICO sizes and 128px UI asset.'
