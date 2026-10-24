$iconDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'build'
$pngPath = Join-Path $iconDirectory 'icon.png'
$icoPath = Join-Path $iconDirectory 'icon.ico'
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap 256,256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::FromArgb(194,237,145))
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(25,39,21)), 13
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$graphics.DrawLine($pen,55,111,55,145)
$graphics.DrawLine($pen,91,80,91,176)
$graphics.DrawLine($pen,128,56,128,200)
$graphics.DrawLine($pen,165,92,165,164)
$graphics.DrawLine($pen,201,111,201,145)
$bitmap.Save($pngPath,[System.Drawing.Imaging.ImageFormat]::Png)
$png = [System.IO.File]::ReadAllBytes($pngPath)
$stream = [System.IO.File]::Create($icoPath)
$writer = New-Object System.IO.BinaryWriter $stream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
$writer.Dispose(); $graphics.Dispose(); $pen.Dispose(); $bitmap.Dispose()
