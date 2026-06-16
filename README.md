# Fynix Chat

A self-hosted, server-side PWA for AI chat powered by NVIDIA NIM, with multi-persona support, file library, and persistent SQLite storage.

## Features

- **Real-time AI Chat** — Streaming responses with markdown rendering and code syntax highlighting
- **Bot Personas** — Fully customizable AI personalities with persistent memory
- **Conversation Management** — Create, search, rename, and manage chat histories
- **File Library** — Upload once, reuse across conversations. Supports images and documents
- **User Profile** — Describe yourself so the AI can tailor responses to your context
- **Server-Side Storage** — All data in SQLite via Docker volume — survives container recreates
- **PWA** — Installable, responsive on mobile and desktop
- **Theme Support** — Light, dark, and system-following modes

## Deploy

Pre-built image: `ghcr.io/boc86/fynix-chat:latest`

### Docker

```bash
docker run -d \
  -p 3000:3000 \
  -v fynix-data:/data \
  --name fynix-chat \
  ghcr.io/boc86/fynix-chat:latest
```

### Docker Compose

```yaml
version: '3.8'

volumes:
  fynix-data:

services:
  fynix-chat:
    image: ghcr.io/boc86/fynix-chat:latest
    ports:
      - "3000:3000"
    volumes:
      - fynix-data:/data
    restart: unless-stopped
```

Access at http://localhost:3000

**Note:** Designed for private networks (e.g., Tailscale). No authentication built-in — restrict access at the network level.

### Portainer

1. Go to **Stacks** → **Add stack**
2. Name: `fynix-chat`
3. Build method: **Web editor**
4. Paste the compose config above
5. Deploy

The `fynix-data` volume persists your conversations, personas, API configs, user profile, preferences, and uploaded files across container recreates.

### Post-Deploy

Open the app and configure your NIM API credentials in the **Settings** panel (gear icon).

## Configuration

1. Open Settings (gear icon)
2. Add your NVIDIA NIM API configuration:
   - **Name**: A friendly name (e.g., "My NIM")
   - **API Key**: Your NVIDIA NIM API key
   - **Base URL**: `https://integrate.api.nvidia.com/v1` (or your custom endpoint)
   - **Model**: e.g., `meta/llama-3.1-8b-instruct`

3. Configure your bot's persona in the **Bot Persona** panel
4. Set your user profile in the **User Profile** panel

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state)
- better-sqlite3 (server-side database)
- Vite PWA Plugin
