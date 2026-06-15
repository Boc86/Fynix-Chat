# NIM Chat PWA

A modern, responsive Progressive Web App for AI chat powered by NVIDIA NIM inference microservices.

## Features

- **Real-time AI Chat** - Streaming responses with markdown rendering and code syntax highlighting
- **Bot Persona** - Fully customizable AI personality with persistent memory
- **Conversation Management** - Create, search, and manage chat histories
- **File Attachments** - Image upload support for vision-capable models
- **PWA** - Installable, offline-capable, works on mobile and desktop
- **Responsive UI** - Seamless experience across all screen sizes
- **Theme Support** - Light, dark, and system-following modes

## Quick Start

### Prerequisites
- Node.js 18+
- NVIDIA NIM API access and API key

### Development

```bash
npm install
npm run dev
```

### Docker

```bash
docker-compose up -d
```

Access at http://localhost:3000

**Note:** Designed for private networks (e.g., Tailscale). No authentication built-in - restrict access at the network level.

### Portainer / Container Manager Deployment

**Option A: Docker Compose (Portainer Stacks)**

1. Build locally first:
   ```bash
   docker build -t fynix-chat .
   ```

2. In Portainer:
   - Go to **Stacks** → **Add stack**
   - Name: `fynix-chat`
   - Build method: **Web editor**
   - Paste the contents of `docker-compose.yml`

3. Deploy the stack

**Option B: Image from GitHub Container Registry**

1. Push built image to a registry (Docker Hub, GHCR, etc.) or build in Portainer

2. Use this compose in Portainer:
   ```yaml
   version: '3.8'
   services:
     fynix-chat:
       image: <your-image>
       ports:
         - "3000:3000"
       restart: unless-stopped
   ```

**Option C: Portainer Build**

1. In Portainer, create a **Custom template** or use **Web editor** with:
   ```yaml
   version: '3.8'
   services:
     fynix-chat:
       build: .
       ports:
         - "3000:3000"
       restart: unless-stopped
   ```

2. Point to your cloned GitHub repo or upload the project files

**Post-Deploy:**

Access at `http://<your-server>:3000` and configure your NIM API credentials in the Settings panel.

## Configuration

1. Open Settings (gear icon)
2. Add your NVIDIA NIM API configuration:
   - **Name**: A friendly name (e.g., "My NIM")
   - **API Key**: Your NVIDIA NIM API key
   - **Base URL**: `https://ai.api.nvidia.com/v1` (or your custom endpoint)
   - **Model**: e.g., `meta/llama-3.1-405b-instruct`

3. Configure your bot's persona in the Bot Persona panel

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state)
- Dexie.js (IndexedDB storage)
- Vite PWA Plugin

## Data Storage

All data (conversations, API keys, preferences, persona) is stored locally in your browser's IndexedDB. Nothing is sent to external servers except your chat messages to the configured NIM endpoint.