# Docker Deployment Guide

This guide covers deploying the Sidelick application using Docker and Docker Compose, both locally and to a remote server via GitHub Actions.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Development with Docker](#local-development-with-docker)
- [Production Deployment via GitHub Actions](#production-deployment-via-github-actions)
- [Manual Server Deployment](#manual-server-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### For Local Development
- Docker Desktop (or Docker Engine + Docker Compose)
- At least 4GB of available RAM

### For Production Deployment
- A Linux server (Ubuntu 20.04+ recommended)
- Docker and Docker Compose installed on the server
- SSH access to the server
- GitHub repository with Actions enabled

---

## Local Development with Docker

### 1. Setup Environment Variables

Copy the example environment file:
```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and set the required values:
```bash
# Minimum required configuration
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_very_long_random_secret
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 2. Build and Run

Build and start all services:
```bash
docker compose --env-file .env.docker up -d --build
```

The services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **PostgreSQL**: localhost:5432

### 3. View Logs

View logs from all services:
```bash
docker compose --env-file .env.docker logs -f
```

View logs from a specific service:
```bash
docker compose --env-file .env.docker logs -f backend
docker compose --env-file .env.docker logs -f frontend
docker compose --env-file .env.docker logs -f postgres
```

### 4. Stop Services

Stop all containers:
```bash
docker compose --env-file .env.docker down
```

Stop and remove volumes (⚠️ this will delete your database):
```bash
docker compose --env-file .env.docker down -v
```

---

## Production Deployment via GitHub Actions

The project includes an automated deployment workflow that builds Docker images and deploys them to your server via SSH.

### 1. Server Setup

On your production server, install Docker and Docker Compose:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Add your user to docker group (optional, to run docker without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Create deployment directory
sudo mkdir -p /opt/sidelick
sudo chown $USER:$USER /opt/sidelick
```

### 2. Verify Deployment Directory

The workflow will automatically create `/opt/sidelick` and generate the `.env.docker` file from GitHub Secrets.

Optionally, you can pre-create the directory:

```bash
sudo mkdir -p /opt/sidelick
sudo chown $USER:$USER /opt/sidelick
```

**Note:** You do NOT need to manually create `.env.docker` on the server - the GitHub Actions workflow will generate it automatically from the secrets you configure in step 3.

### 3. Configure GitHub Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions** and add:

#### SSH Connection Secrets

| Secret Name | Description | Example | Required |
|------------|-------------|---------|----------|
| `SSH_HOST` | Server IP or hostname | `192.168.1.100` or `server.example.com` | ✅ |
| `SSH_USERNAME` | SSH username | `ubuntu` or `deploy` | ✅ |
| `SSH_PASSWORD` | SSH password for the user | `your_secure_password` | ✅ |
| `SSH_PORT` | SSH port (optional, defaults to 22) | `22` | ❌ |

#### Application Environment Secrets

The workflow will automatically create the `.env.docker` file on the server from these secrets:

| Secret Name | Description | Example | Required |
|------------|-------------|---------|----------|
| `POSTGRES_PASSWORD` | PostgreSQL database password | `strong_db_password` | ✅ |
| `JWT_SECRET` | JWT signing secret | `very_long_random_secret_key` | ✅ |
| `CORS_ORIGIN` | Allowed CORS origins | `https://yourdomain.com` | ✅ |
| `FRONTEND_URL` | Frontend URL | `https://yourdomain.com` | ✅ |
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.yourdomain.com` | ✅ |
| `JWT_EXPIRES_IN` | JWT expiration time | `7d` | ❌ |
| `VAPID_PUBLIC_KEY` | Web push public key | `BN...` | ❌ |
| `VAPID_PRIVATE_KEY` | Web push private key | `...` | ❌ |
| `VAPID_SUBJECT` | Web push subject | `mailto:support@sidelick.app` | ❌ |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` | ❌ |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | `pk_live_...` | ❌ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | `whsec_...` | ❌ |

**Note:** The workflow uses password-based authentication and automatically creates the `.env.docker` file from GitHub Secrets. Make sure your server allows password authentication in SSH config (`/etc/ssh/sshd_config` should have `PasswordAuthentication yes`).

### 4. Trigger Deployment

The workflow automatically runs when you push to `main` or `develop` branches:

```bash
git add .
git commit -m "Deploy to production"
git push origin main
```

Or trigger manually from GitHub:
- Go to **Actions** tab
- Select **Deploy to Server via SSH**
- Click **Run workflow**

### 5. Deployment Process

The GitHub Actions workflow will:

1. ✅ Build frontend Docker image
2. ✅ Build backend Docker image
3. ✅ Pull PostgreSQL image
4. ✅ Export images to tar files
5. ✅ Transfer tar files to server via SCP
6. ✅ Transfer docker-compose.yml and schema.sql
7. ✅ Load images on the server
8. ✅ Stop old containers
9. ✅ Start new containers with docker-compose
10. ✅ Verify deployment
11. ✅ Clean up old images

---

## Manual Server Deployment

If you prefer to deploy manually without GitHub Actions:

### 1. Build Images Locally

```bash
# Build frontend
docker build -t sidelick-frontend:latest ./frontend

# Build backend
docker build -t sidelick-backend:latest ./backend

# Export images
docker save sidelick-frontend:latest -o frontend-image.tar
docker save sidelick-backend:latest -o backend-image.tar
docker pull postgres:16-alpine
docker save postgres:16-alpine -o postgres-image.tar
```

### 2. Transfer to Server

```bash
# Transfer images
scp frontend-image.tar backend-image.tar postgres-image.tar user@server:/tmp/

# Transfer application files
scp docker-compose.yml schema.sql .env.docker.example user@server:/opt/sidelick/
```

### 3. Deploy on Server

```bash
ssh user@server

# Load images
docker load -i /tmp/frontend-image.tar
docker load -i /tmp/backend-image.tar
docker load -i /tmp/postgres-image.tar

# Navigate to app directory
cd /opt/sidelick

# Configure environment (if not done already)
cp .env.docker.example .env.docker
nano .env.docker

# Deploy
docker compose --env-file .env.docker up -d

# Check status
docker compose --env-file .env.docker ps
```

---

## Troubleshooting

### Check Container Status
```bash
docker compose --env-file .env.docker ps
```

### View Logs
```bash
# All services
docker compose --env-file .env.docker logs

# Specific service
docker compose --env-file .env.docker logs backend -f
```

### Restart a Service
```bash
docker compose --env-file .env.docker restart backend
```

### Access Database
```bash
docker compose --env-file .env.docker exec postgres psql -U sidelick -d sidelick
```

### Reset Database (⚠️ Destructive)
```bash
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d
```

### Check Backend Health
```bash
curl http://localhost:4000/health
# or on production
curl https://api.yourdomain.com/health
```

### SSH Connection Issues (GitHub Actions)

If deployment fails with SSH errors:

1. Verify SSH password is correct in GitHub Secrets
2. Ensure password authentication is enabled on your server:
   ```bash
   # On the server, check SSH config
   sudo grep PasswordAuthentication /etc/ssh/sshd_config
   # Should show: PasswordAuthentication yes

   # If not, enable it:
   sudo sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
   sudo systemctl restart sshd
   ```
3. Test SSH connection manually:
   ```bash
   ssh user@server
   ```
4. Check server firewall allows SSH on the configured port
5. Ensure the SSH user has permission to run Docker commands:
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   ```

### Docker Build Failures

If images fail to build:

1. Check Dockerfile syntax
2. Ensure all dependencies are in package.json
3. Review build logs in GitHub Actions
4. Try building locally to debug:
   ```bash
   docker build -t test-build ./frontend
   ```

### Container Exits Immediately

1. Check environment variables are set correctly
2. Review container logs:
   ```bash
   docker compose --env-file .env.docker logs backend
   ```
3. Verify database connection string
4. Check if ports are already in use

### Database Connection Errors

1. Verify `DATABASE_URL` in `.env.docker`
2. Ensure PostgreSQL container is healthy:
   ```bash
   docker compose --env-file .env.docker ps postgres
   ```
3. Check if schema.sql loaded correctly:
   ```bash
   docker compose --env-file .env.docker exec postgres psql -U sidelick -d sidelick -c "\dt"
   ```

---

## Production Considerations

### Reverse Proxy (Nginx)

For production, use a reverse proxy:

```nginx
# /etc/nginx/sites-available/sidelick
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then use Certbot for SSL:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Backups

Set up automated PostgreSQL backups:

```bash
# Create backup script
cat > /opt/sidelick/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/sidelick/backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker compose --env-file /opt/sidelick/.env.docker exec -T postgres pg_dump -U sidelick sidelick | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /opt/sidelick/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/sidelick/backup.sh") | crontab -
```

### Monitoring

Monitor container health:

```bash
# Install docker-compose-healthcheck script
docker compose --env-file .env.docker ps --format json | jq
```

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
