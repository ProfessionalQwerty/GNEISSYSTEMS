@echo off
echo 🔧 Installing GNEISS CLI...

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Build the CLI
echo 🔨 Building CLI...
call npm run build

REM Create a symlink for global usage (optional)
echo 🔗 Setting up global command...
call npm link

echo ✅ GNEISS CLI installed successfully!
echo 🚀 You can now use 'gneiss' command from anywhere.
echo.
echo To get started:
echo   gneiss auth    # Authenticate with GitHub
echo   gneiss audit .\your-project  # Analyze a Java project
