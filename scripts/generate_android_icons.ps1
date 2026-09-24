Add-Type -AssemblyName System.Drawing

$srcPath = "c:\Users\SHREE\Documents\dili-neon-run\public\assets\dili.png"
$resDir = "c:\Users\SHREE\Documents\dili-neon-run\android\app\src\main\res"

$srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)

function Resize-Image {
    param(
        [System.Drawing.Bitmap]$source,
        [int]$targetWidth,
        [int]$targetHeight,
        [int]$contentPadding,
        [System.Drawing.Color]$bgColor,
        [bool]$isRound,
        [string]$outputPath
    )

    $destBmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bgColor)

    if ($isRound) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $targetWidth, $targetHeight)
        $g.SetClip($path)
        $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 6, 7, 21)) # #060715
        $g.FillPath($bgBrush, $path)
    }

    $drawW = $targetWidth - ($contentPadding * 2)
    $drawH = $targetHeight - ($contentPadding * 2)
    $drawX = $contentPadding
    $drawY = $contentPadding

    $g.DrawImage($source, $drawX, $drawY, $drawW, $drawH)
    $g.Dispose()

    $destBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
}

# Icon density buckets
$densities = @(
    @{ Name = "mipmap-mdpi";    IconSize = 48;  FgSize = 108; FgPad = 18 },
    @{ Name = "mipmap-hdpi";    IconSize = 72;  FgSize = 162; FgPad = 27 },
    @{ Name = "mipmap-xhdpi";   IconSize = 96;  FgSize = 216; FgPad = 36 },
    @{ Name = "mipmap-xxhdpi";  IconSize = 144; FgSize = 324; FgPad = 54 },
    @{ Name = "mipmap-xxxhdpi"; IconSize = 192; FgSize = 432; FgPad = 72 }
)

$darkBg = [System.Drawing.Color]::FromArgb(255, 6, 7, 21) # #060715
$transparent = [System.Drawing.Color]::Transparent

foreach ($d in $densities) {
    $dir = Join-Path $resDir $d.Name
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    # 1. Adaptive Foreground (transparent bg)
    $fgPath = Join-Path $dir "ic_launcher_foreground.png"
    Resize-Image -source $srcBmp -targetWidth $d.FgSize -targetHeight $d.FgSize -contentPadding $d.FgPad -bgColor $transparent -isRound $false -outputPath $fgPath

    # 2. Legacy Square Icon (dark #060715 bg)
    $pad = [int]($d.IconSize * 0.1)
    $iconPath = Join-Path $dir "ic_launcher.png"
    Resize-Image -source $srcBmp -targetWidth $d.IconSize -targetHeight $d.IconSize -contentPadding $pad -bgColor $darkBg -isRound $false -outputPath $iconPath

    # 3. Round Icon
    $roundPath = Join-Path $dir "ic_launcher_round.png"
    Resize-Image -source $srcBmp -targetWidth $d.IconSize -targetHeight $d.IconSize -contentPadding $pad -bgColor $transparent -isRound $true -outputPath $roundPath
}

# Splash screen images
$splashDrawables = @(
    @{ Dir = "drawable"; Width = 480; Height = 800; Pad = 160 },
    @{ Dir = "drawable-port-mdpi"; Width = 320; Height = 480; Pad = 90 },
    @{ Dir = "drawable-port-hdpi"; Width = 480; Height = 800; Pad = 140 },
    @{ Dir = "drawable-port-xhdpi"; Width = 720; Height = 1280; Pad = 210 },
    @{ Dir = "drawable-port-xxhdpi"; Width = 960; Height = 1600; Pad = 280 },
    @{ Dir = "drawable-port-xxxhdpi"; Width = 1280; Height = 1920; Pad = 360 },
    @{ Dir = "drawable-land-mdpi"; Width = 480; Height = 320; Pad = 70 },
    @{ Dir = "drawable-land-hdpi"; Width = 800; Height = 480; Pad = 110 },
    @{ Dir = "drawable-land-xhdpi"; Width = 1280; Height = 720; Pad = 160 },
    @{ Dir = "drawable-land-xxhdpi"; Width = 1600; Height = 960; Pad = 210 },
    @{ Dir = "drawable-land-xxxhdpi"; Width = 1920; Height = 1280; Pad = 280 }
)

foreach ($s in $splashDrawables) {
    $dir = Join-Path $resDir $s.Dir
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $splashPath = Join-Path $dir "splash.png"

    # For splash, center the mascot proportionally
    $destBmp = New-Object System.Drawing.Bitmap $s.Width, $s.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($darkBg)

    $logoDim = [Math]::Min($s.Width, $s.Height) - ($s.Pad * 2)
    if ($logoDim -lt 64) { $logoDim = 64 }
    $logoX = [int](($s.Width - $logoDim) / 2)
    $logoY = [int](($s.Height - $logoDim) / 2)

    $g.DrawImage($srcBmp, $logoX, $logoY, $logoDim, $logoDim)
    $g.Dispose()

    $destBmp.Save($splashPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $destBmp.Dispose()
}

$srcBmp.Dispose()
Write-Output "Android icons and splash screens generated successfully!"
