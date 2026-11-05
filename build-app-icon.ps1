param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Icon]::new((Resolve-Path $Source).Path)
$sourceBitmap = $icon.ToBitmap()
$bitmap = [System.Drawing.Bitmap]::new(
  256,
  256,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.DrawImage($sourceBitmap, 0, 0, 256, 256)

$iconHeaderSize = 40
$pixelDataSize = 256 * 256 * 4
$maskRowSize = 256 / 8
$maskDataSize = $maskRowSize * 256
$imageDataSize = $iconHeaderSize + $pixelDataSize + $maskDataSize
$pixelRect = [System.Drawing.Rectangle]::new(0, 0, 256, 256)
$lockedBitmap = $bitmap.LockBits(
  $pixelRect,
  [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$pixels = [byte[]]::new($pixelDataSize)
for ($y = 0; $y -lt 256; $y++) {
  [System.Runtime.InteropServices.Marshal]::Copy(
    [IntPtr]::Add($lockedBitmap.Scan0, $y * $lockedBitmap.Stride),
    $pixels,
    $y * 256 * 4,
    256 * 4
  )
}
$bitmap.UnlockBits($lockedBitmap)

$outputStream = [System.IO.File]::Create($Destination)
$writer = [System.IO.BinaryWriter]::new($outputStream)
$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]1)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]$imageDataSize)
$writer.Write([UInt32]22)
$writer.Write([UInt32]$iconHeaderSize)
$writer.Write([Int32]256)
$writer.Write([Int32]512)
$writer.Write([UInt16]1)
$writer.Write([UInt16]32)
$writer.Write([UInt32]0)
$writer.Write([UInt32]$pixelDataSize)
$writer.Write([Int32]0)
$writer.Write([Int32]0)
$writer.Write([UInt32]0)
$writer.Write([UInt32]0)

for ($y = 255; $y -ge 0; $y--) {
  $writer.Write($pixels, $y * 256 * 4, 256 * 4)
}
$writer.Write([byte[]]::new($maskDataSize))

$writer.Dispose()
$outputStream.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
$sourceBitmap.Dispose()
$icon.Dispose()
