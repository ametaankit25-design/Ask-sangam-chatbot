#!/usr/bin/env bash
# ==============================================================================
# Ask Sangam - AWS EC2 Initial Server Setup Script
# Works on: Ubuntu 22.04 / 24.04 & Amazon Linux 2023
# ==============================================================================

set -e

echo "=================================================="
echo "🚀 Starting Ask Sangam EC2 Setup..."
echo "=================================================="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "❌ Cannot determine OS. Exiting."
    exit 1
fi

echo "📦 Detected OS: $OS"

if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    echo "🔄 Updating Ubuntu/Debian packages..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release git

    # Add Docker GPG key & repo if not present
    if ! command -v docker &> /dev/null; then
        echo "🐳 Installing Docker & Docker Compose..."
        sudo install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        sudo chmod a+r /etc/apt/keyrings/docker.gpg

        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
          $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
          sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

        sudo apt-get update -y
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi

elif [ "$OS" = "amzn" ] || [ "$OS" = "almalinux" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    echo "🔄 Updating Amazon Linux / RHEL packages..."
    sudo dnf update -y || sudo yum update -y
    sudo dnf install -y docker git || sudo yum install -y docker git
    
    # Install Docker Compose & Docker Buildx plugins
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

    BUILDX_ARCH=$(uname -m)
    [ "$BUILDX_ARCH" = "x86_64" ] && BUILDX_ARCH="amd64"
    [ "$BUILDX_ARCH" = "aarch64" ] && BUILDX_ARCH="arm64"
    sudo curl -SL "https://github.com/docker/buildx/releases/latest/download/buildx-linux-${BUILDX_ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-buildx
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
fi

# Enable and start Docker service
echo "▶️ Enabling and starting Docker daemon..."
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker "$USER"

# Create persistent storage folders
mkdir -p backend/data backend/documents

# Setup .env if it does not exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📝 Creating .env from .env.example..."
        cp .env.example .env
        echo "⚠️ Please edit .env with your GOOGLE_API_KEY and production secrets!"
    fi
fi

echo "=================================================="
echo "✅ EC2 Setup Completed Successfully!"
echo "=================================================="
echo ""
echo "Next Steps:"
echo "1. Run: newgrp docker  (or logout and log back in to apply docker group changes)"
echo "2. Edit your .env file: nano .env (add your GOOGLE_API_KEY)"
echo "3. Start the application: ./deploy.sh"
echo "=================================================="
