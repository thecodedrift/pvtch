# PVTCH

Simple streamer tools for Twitch content creators.

PVTCH provides lightweight, embeddable widgets and utilities for streamers:

- **Progress Tracking** - Display progress bars in OBS for goals, challenges, or achievements
- **Lingo (AI Translation)** - Real-time chat translation powered by Cloudflare

Built for simplicity - no complex setup, no databases to manage, just connect your Twitch account and start using.

Also deployable to your own Cloudflare account for full control.

## Design

PVTCH runs entirely on [Cloudflare Workers](https://workers.cloudflare.com/), making it fast, globally distributed, and easy to self-host. The stack includes:

- **Workers** - Serverless compute for API and pages
- **Durable Objects** - Persistent state with SQLite storage
- **KV** - Fast key-value storage for caching and tokens
- **Cloudflare AI** - Powers the Lingo translation feature

You can deploy PVTCH to your own Cloudflare account with minimal configuration.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+
- Cloudflare account (free tier works)

### Local Development

```bash
# Clone the repository
git clone https://github.com/thecodedrift/pvtch.git
cd pvtch-api

# Install dependencies
pnpm install

# Create a .dev.vars file in workers/core/ with your secrets
# (see workers/core/.dev.vars.example if available)

# Start the dev server
cd workers/core
pnpm run dev
```

### Configuration

Create the following secrets in your Cloudflare dashboard or via `wrangler secret put`:

- `TWITCH_SECRET` - Your Twitch application client secret

### Deploy

```bash
cd workers/core
pnpm run deploy
```
