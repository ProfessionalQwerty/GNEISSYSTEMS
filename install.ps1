# GNEISS CLI Installer for Windows

Write-Host "🔧 Installing GNEISS CLI..." -ForegroundColor Cyan

# Detect system architecture
$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -eq "AMD64") {
    $arch = "amd64"
} elseif ($arch -eq "ARM64") {
    $arch = "arm64"
} else {
    Write-Host "❌ Unsupported architecture: $arch" -ForegroundColor Red
    exit 1
}

$os = "windows"

# Get latest release version
Write-Host "📦 Fetching latest release..." -ForegroundColor Cyan
try {
    $latestRelease = (Invoke-RestMethod -Uri "https://api.github.com/repos/ProfessionalQwerty/GNEISSYSTEMS/releases/latest").tag_name
} catch {
    Write-Host "❌ Failed to fetch latest release" -ForegroundColor Red
    exit 1
}

if (-not $latestRelease) {
    Write-Host "❌ Failed to fetch latest release" -ForegroundColor Red
    exit 1
}

Write-Host "📥 Downloading GNEISS CLI $latestRelease for $os-$arch..." -ForegroundColor Cyan

# Download binary from the latest GitHub release asset
$assetName = "gneiss-windows-amd64.exe"
$downloadUrl = "https://github.com/ProfessionalQwerty/GNEISSYSTEMS/releases/download/$latestRelease/$assetName"

# Create temp directory
$tempDir = Join-Path $env:TEMP "gneiss-install"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Set-Location $tempDir

# Download
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $assetName -UseBasicParsing
} catch {
    Write-Host "❌ Failed to download binary from $downloadUrl" -ForegroundColor Red
    exit 1
}

# Install to user's local bin
$installDir = Join-Path $env:USERPROFILE "bin"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

Write-Host "🔨 Installing to $installDir..." -ForegroundColor Cyan
Move-Item -Path $assetName -Destination "$installDir\gneiss.exe" -Force

# Add to PATH if not already there
$pathEnv = [Environment]::GetEnvironmentVariable("Path", "User")
if ($pathEnv -notlike "*$installDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$pathEnv;$installDir", "User")
    Write-Host "🔗 Added $installDir to PATH" -ForegroundColor Cyan
    Write-Host "⚠️  Please restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
}

# Cleanup
Set-Location $env:USERPROFILE
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "✅ GNEISS CLI installed successfully!" -ForegroundColor Green
Write-Host "🚀 You can now use 'gneiss' command from anywhere." -ForegroundColor Green
Write-Host ""
Write-Host "To get started:" -ForegroundColor Cyan
Write-Host "  gneiss auth                 # Authenticate with GitHub" -ForegroundColor White
Write-Host "  gneiss audit .\your-project # Analyze a Java project" -ForegroundColor White
Write-Host "  gneiss update               # Check for CLI updates" -ForegroundColor White
