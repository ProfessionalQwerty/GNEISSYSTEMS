#!/bin/bash

set -e

echo "🔧 Installing GNEISS CLI..."

# Detect system architecture
ARCH=$(uname -m)
OS=$(uname -s)

case "$OS" in
    Linux*)
        OS="linux"
        ;;
    Darwin*)
        OS="darwin"
        ;;
    *)
        echo "❌ Unsupported OS: $OS"
        exit 1
        ;;
esac

case "$ARCH" in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Get latest release version
echo "📦 Fetching latest release..."
LATEST_RELEASE=$(curl -s https://api.github.com/repos/ProfessionalQwerty/GNEISSYSTEMS/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_RELEASE" ]; then
    echo "❌ Failed to fetch latest release"
    exit 1
fi

echo "� Downloading GNEISS CLI $LATEST_RELEASE for $OS-$ARCH..."

# Download binary - CLI folder is uploaded directly to main branch
DOWNLOAD_URL="https://github.com/ProfessionalQwerty/GNEISSYSTEMS/releases/download/${LATEST_RELEASE}/gneiss"

# Create temp directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Download
curl -fsSL "$DOWNLOAD_URL" -o gneiss

# Make executable
chmod +x gneiss

# Install to /usr/local/bin
INSTALL_DIR="/usr/local/bin"
if [ ! -d "$INSTALL_DIR" ]; then
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
fi

echo "� Installing to $INSTALL_DIR..."
sudo mv gneiss "$INSTALL_DIR/gneiss" 2>/dev/null || mv gneiss "$INSTALL_DIR/gneiss"

# Cleanup
cd -
rm -rf "$TEMP_DIR"

echo "✅ GNEISS CLI installed successfully!"
echo "🚀 You can now use 'gneiss' command from anywhere."
echo ""
echo "To get started:"
echo "  gneiss auth    # Authenticate with GitHub"
echo "  gneiss audit ./your-project  # Analyze a Java project"
