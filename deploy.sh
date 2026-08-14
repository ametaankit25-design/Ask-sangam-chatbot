#!/usr/bin/env bash
# ==============================================================================
# Ask Sangam - Build & Launch Containers
# ==============================================================================

set -e

echo "=================================================="
echo "🚀 Deploying Ask Sangam..."
echo "=================================================="

# Check for .env
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "⚠️ .env file not found. Copying .env.example to .env..."
        cp .env.example .env
        echo "⚠️ Created default .env. Remember to edit .env with your secrets & GOOGLE_API_KEY."
    else
        echo "❌ Error: .env file missing."
        exit 1
    fi
fi

# Ensure persistent directories exist
mkdir -p backend/data backend/documents

# Build and start services in detached mode
echo "📦 Building and starting Docker containers..."
docker compose up -d --build --remove-orphans

echo ""
echo "⏳ Waiting for containers to initialize..."
sleep 5

# Show status
echo ""
echo "📊 Container Status:"
docker compose ps

echo ""
echo "=================================================="
echo "🎉 Ask Sangam is running!"
echo "➡️ Web Application: http://<EC2-PUBLIC-IP> (Port 80)"
echo "➡️ API Direct:      http://<EC2-PUBLIC-IP>:5000"
echo "➡️ View Logs:       docker compose logs -f"
echo "=================================================="
