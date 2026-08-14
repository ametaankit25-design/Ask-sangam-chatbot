# 🚀 Ask Sangam - AWS EC2 Deployment & Docker Guide

This guide walks you through deploying the complete **Ask Sangam** application (React Frontend + Flask RAG Backend + Nginx Reverse Proxy) onto an **AWS EC2** instance using Docker and Docker Compose.

---

## 🏗 Architecture Overview

```
                          Internet / Users
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   AWS EC2 Instance    │
                     │  (Security Group:     │
                     │   Ports 80, 443, 22)  │
                     └───────────┬───────────┘
                                 │
                                 ▼
               ┌───────────────────────────────────┐
               │    Frontend Container (Nginx)     │
               │    Port 80 (HTTP) / 443 (HTTPS)   │
               └─────────┬───────────────┬─────────┘
                         │               │
      Static Assets (SPA)│               │ Reverse Proxy (/api/*)
                         ▼               ▼
                  React Vite App   ┌───────────┴──────────┐
                                   │   Backend Container  │
                                   │  (Flask + Gunicorn)  │
                                   │      Port 5000       │
                                   └───────────┬──────────┘
                                               │
                       ┌───────────────────────┴───────────────────────┐
                       ▼                                               ▼
              Google Gemini API / LLM                        Persistent SQLite & FAISS
                                                             (/app/data, /app/documents)
```

---

## 📋 Prerequisites

1. An **AWS Account** ([aws.amazon.com](https://aws.amazon.com/)).
2. A **Google Gemini API Key** ([aistudio.google.com](https://aistudio.google.com/app/apikey)) or Google Cloud OAuth credentials.
3. An SSH Key Pair (`.pem` file) created in AWS EC2 Console.

---

## Step 1: Launch an AWS EC2 Instance

1. Open the [AWS EC2 Management Console](https://console.aws.amazon.com/ec2/).
2. Click **Launch Instance**.
3. Configure the instance:
   - **Name**: `ask-sangam-server`
   - **AMI (Operating System)**: **Ubuntu Server 24.04 LTS** (or Amazon Linux 2023).
   - **Instance Type**:
     - `t3.small` (2 vCPU, 2 GB RAM) - *Recommended for production*.
     - `t2.micro` (1 vCPU, 1 GB RAM) - *Eligible for AWS Free Tier*.
   - **Key Pair**: Select or create a key pair (e.g., `sangam-key.pem`) and download it.
   - **Network Settings / Security Group**:
     - Check **Allow SSH traffic from Anywhere** (`0.0.0.0/0` or your IP).
     - Check **Allow HTTP traffic from the internet** (Port `80`).
     - Check **Allow HTTPS traffic from the internet** (Port `443`).
   - **Storage**: 20–30 GiB gp3 SSD.
4. Click **Launch Instance**.

---

## Step 2: Connect to Your EC2 Instance via SSH

Open your local terminal (PowerShell, Command Prompt, or Linux/macOS terminal):

```bash
# Set appropriate permissions for your key file (Mac/Linux)
chmod 400 sangam-key.pem

# SSH into your EC2 instance (replace with your instance's Public IPv4)
ssh -i "sangam-key.pem" ubuntu@<EC2-PUBLIC-IP>
```
*(If you launched Amazon Linux, use `ec2-user@<EC2-PUBLIC-IP>`)*

---

## Step 3: Clone the Repository & Run Setup

Once connected to your EC2 instance:

```bash
# 1. Clone your project repository
git clone <YOUR-GITHUB-REPO-URL> ask-sangam
cd ask-sangam

# 2. Make scripts executable
chmod +x setup-ec2.sh deploy.sh

# 3. Run initial server setup (installs Docker & Compose)
./setup-ec2.sh

# 4. Activate Docker group permissions
newgrp docker
```

---

## Step 4: Configure Environment Variables

Edit the production configuration in `.env`:

```bash
nano .env
```

Set your production secrets and API keys:

```ini
# 1. Security Secrets (generate random strings or keep secure values)
SECRET_KEY=generate_a_random_secret_string_here
JWT_SECRET_KEY=generate_a_random_jwt_secret_here
JWT_EXPIRATION_HOURS=24

# 2. Google OAuth (optional, for Google Login)
GOOGLE_CLIENT_ID=288291673778-u7cbjjafogp1gjpionp6cscf6ct81gu8.apps.googleusercontent.com

# 3. Google Gemini API (Required for cloud LLM & embeddings)
GOOGLE_API_KEY=AIzaSy...your_gemini_api_key...
GOOGLE_GENAI_MODEL=gemini-3.6-flash

# 4. Network & Knowledge Base
PORT=5000
CORS_ORIGINS=*
UNIVERSITY_WEBSITE_URL=https://sangamuniversity.ac.in/
```

Press `Ctrl + O`, `Enter` to save, and `Ctrl + X` to exit.

---

## Step 5: Build and Launch Containers

Run the automated deployment script:

```bash
./deploy.sh
```

Or execute Docker Compose directly:

```bash
docker compose up -d --build
```

Verify that both containers are running and healthy:

```bash
docker compose ps
```

You should see:
```text
NAME                  IMAGE                  STATUS                   PORTS
ask-sangam-backend    ask-sangam-backend     Up (healthy)             0.0.0.0:5000->5000/tcp
ask-sangam-frontend   ask-sangam-frontend    Up (healthy)             0.0.0.0:80->80/tcp
```

---

## Step 6: Access Your Live Application

Open your web browser and navigate to:

```text
http://<YOUR-EC2-PUBLIC-IP>
```

- **Frontend App**: `http://<YOUR-EC2-PUBLIC-IP>` (Served on standard Port 80)
- **Backend API Health Check**: `http://<YOUR-EC2-PUBLIC-IP>/api/health`

---

## 🔒 Optional: Add Free SSL & Custom Domain (HTTPS)

If you have a domain name pointing to your EC2 Public IP (e.g., `sangam.yourdomain.com`):

### 1. Install Certbot on EC2
```bash
sudo apt-get install -y certbot
```

### 2. Obtain SSL Certificate
Temporarily stop frontend to bind port 80 for verification:
```bash
docker compose stop frontend
sudo certbot certonly --standalone -d sangam.yourdomain.com
```

### 3. Mount Certificates & Enable Port 443 in `docker-compose.yml`
Update `frontend` service in `docker-compose.yml`:
```yaml
  frontend:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Restart containers:
```bash
docker compose up -d
```

---

## 🛠 Useful Management Commands

| Task | Command |
| :--- | :--- |
| **View Live Logs** | `docker compose logs -f` |
| **View Backend Logs** | `docker compose logs -f backend` |
| **Restart Containers** | `docker compose restart` |
| **Stop All Containers** | `docker compose down` |
| **Update Code & Redeploy** | `git pull && ./deploy.sh` |
| **Backup Database** | `cp backend/data/app.db ~/app_backup.db` |
| **Re-index Knowledge Base** | Trigger via `/api/documents/reindex` or UI admin panel |

---

## 💡 Troubleshooting

1. **Cannot access `http://<EC2-PUBLIC-IP>` in browser?**
   - Check AWS EC2 Console -> **Security Groups** -> ensure Inbound Rule exists for **HTTP (Port 80) from 0.0.0.0/0**.
2. **Backend API returns error on Chat queries?**
   - Verify `GOOGLE_API_KEY` is set in `.env` (`cat .env`).
   - Check backend logs: `docker compose logs backend`.
3. **Database resetting after restart?**
   - `./backend/data` is mounted to `/app/data` inside the container, ensuring all user registrations, messages, and vector embeddings are permanently saved on the EC2 host disk.
