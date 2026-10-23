# OnlinePlayer

Paste a link, stream or download it: TeraBox videos, Instagram reels/posts and Spotify tracks/playlists, all in the browser.

**Live:** https://onlineplayer.site · **Status:** https://status.onlineplayer.site

## Architecture

| Part | Path | Runs on | URL |
|---|---|---|---|
| Web app (Next.js static export) | `frontend/` | Cloudflare Pages `onlineplayer` | onlineplayer.site |
| TeraBox worker | `backend/terabox/worker` | Cloudflare Worker `terabox-player-api` | terabox.onlineplayer.site |
| TeraBox cloud resolver | `backend/terabox/resolver` | Render (Node/Express) | terabox-resolver-csit.onrender.com |
| Instagram worker | `backend/instagram/worker` | Cloudflare Worker `instagram-player-api` | instagram.onlineplayer.site |
| Spotify worker | `backend/spotify/worker` | Cloudflare Worker `spotify-player-api` | spotify.onlineplayer.site |
| Health monitor | `backend/monitor/worker` | Cloudflare Worker `onlineplayer-monitor` (cron, every 15 min) | status.onlineplayer.site |

Every provider is its own Worker on its own `<provider>.onlineplayer.site` subdomain, with a `*.onlineplayer.workers.dev` fallback that the frontend uses when the custom domain is unreachable. New providers follow the same pattern.

## Local development

```bash
# frontend
cd frontend && npm install && npm run dev

# any worker
cd backend/spotify/worker && npm install && npm run dev
```

Workers that need secrets read them from a local `.dev.vars` file (gitignored). Copy `.dev.vars.example` where one exists.

Tests:

```bash
cd backend/spotify/worker && npm test   # Spotify → JioSaavn matcher
cd backend/monitor/worker && npm test   # monitor alert/state logic
```

## Secrets (never commit these)

| Where | Name | Purpose |
|---|---|---|
| terabox worker | `DEFAULT_JS_TOKEN`, `COOKIE_POOL`, `RESOLVER_SECRET` | TeraBox auth + shared secret with the resolver |
| Render resolver | `TERABOX_COOKIE` / `COOKIE_POOL`, `RESOLVER_SECRET` | must match the worker's `RESOLVER_SECRET` |
| monitor worker | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (optional), `MONITOR_KEY` | alerts and the manual `POST /api/run` endpoint |

Set worker secrets with `npx wrangler secret put <NAME>` inside the worker folder. CI fails if a known secret pattern is committed.

## Deployment

Pushing to `main` runs CI (tests, syntax check, typecheck, build) and then deploys only the parts that changed, through `.github/workflows/deploy.yml`. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: Cloudflare dashboard → My Profile → API Tokens → *Edit Cloudflare Workers* template, plus **Account → Cloudflare Pages → Edit**.
- `CLOUDFLARE_ACCOUNT_ID`: shown by `npx wrangler whoami` (or the right sidebar of the Workers dashboard)

A manual deploy of one part is available under Actions → Deploy → *Run workflow*. Manual deploys from a laptop still work:

```bash
cd backend/spotify/worker && npm run deploy
cd frontend && npm run build && npx wrangler pages deploy out --project-name onlineplayer --branch main
```

## Monitoring

`backend/monitor/worker` runs every 15 minutes and checks the real user path of each service (resolve → playable stream). The first run of every hour bypasses provider caches. A service that fails twice in a row triggers a Telegram alert, and another one when it recovers. Current state: https://status.onlineplayer.site (JSON at `/api/status`).
