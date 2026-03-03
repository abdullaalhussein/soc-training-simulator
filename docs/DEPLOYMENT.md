# Deployment Guide

## Docker

Multi-stage Dockerfiles for both [server](../server/Dockerfile) and [client](../client/Dockerfile):

```bash
# Build server image (includes YARA binary)
docker build -t soc-server ./server

# Build client image (Next.js standalone)
docker build -t soc-client ./client \
  --build-arg NEXT_PUBLIC_API_URL=https://your-server.example.com \
  --build-arg NEXT_PUBLIC_WS_URL=https://your-server.example.com
```

---

## Railway.app

Deploy 3 services on [Railway](https://railway.app):

1. **PostgreSQL** — Railway plugin (auto-provisions `DATABASE_URL`)
2. **Server** — Uses `server/Dockerfile`, set JWT secrets & CORS origin
3. **Client** — Uses `client/Dockerfile`, set `NEXT_PUBLIC_API_URL` & `NEXT_PUBLIC_WS_URL` as build args

**Important:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are required — the server will not start without them. Set `CORS_ORIGIN` to your client's Railway URL (e.g. `https://your-client.up.railway.app`).

### Quick Deploy Steps

1. Fork this repo
2. Create a new project on [Railway](https://railway.app)
3. Add a **PostgreSQL** plugin (auto-provisions `DATABASE_URL`)
4. Add a **Server** service → point to `server/Dockerfile`, set these env vars:
   - `JWT_SECRET` — a random 32+ character string
   - `JWT_REFRESH_SECRET` — a different random 32+ character string
   - `CORS_ORIGIN` — your client's Railway URL
   - `ANTHROPIC_API_KEY` — (optional) your Anthropic API key for AI features
5. Add a **Client** service → point to `client/Dockerfile`, set build args:
   - `NEXT_PUBLIC_API_URL` — your server's Railway URL
   - `NEXT_PUBLIC_WS_URL` — your server's Railway URL
6. Deploy. Run `npx prisma db push && npx prisma db seed` in the server service shell.

---

## CI/CD

GitHub Actions runs on every push/PR to `master`:
- **Unit tests** — 96 tests via Vitest (scoring, AI filter, CSRF, integration)
- **Type checking** — server and client `tsc --noEmit`
- **Deployment** — auto-deploys to Railway on push to `master` (requires repository secrets)

| Secret | Description |
|--------|-------------|
| `RAILWAY_API_TOKEN` | Railway account API token (Account → Tokens) |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `RAILWAY_SERVER_SERVICE_ID` | Service ID for the server |
| `RAILWAY_CLIENT_SERVICE_ID` | Service ID for the client |

---

## Production Security Checklist

Before deploying to a network-accessible environment:

- [ ] **Change all default passwords** — admin, trainer, and trainee accounts
- [ ] **Set `ALLOW_DEMO_CREDENTIALS=false`** — blocks login with default demo passwords in production
- [ ] **Set strong JWT secrets** — use cryptographically random 32+ character strings for `JWT_SECRET` and `JWT_REFRESH_SECRET`
- [ ] **Configure CORS** — set `CORS_ORIGIN` to your exact client domain (not `*`)
- [ ] **Use HTTPS** — required for secure cookie transport (httpOnly cookies with `secure` and `sameSite: none`)
- [ ] **Set `NODE_ENV=production`** — enables security hardening (Helmet CSP, secure cookies, CSRF enforcement)
- [ ] **Restrict database access** — ensure PostgreSQL is not publicly accessible
- [ ] **Review AI rate limits** — adjust `AI_DAILY_LIMIT` and `AI_DAILY_ORG_LIMIT` based on your user count and budget
- [ ] **Set `CSP_REPORT_URI`** (optional) — receive Content Security Policy violation reports

---

## Minimum Requirements

| Resource | Spec |
|----------|------|
| CPU | 1 vCPU |
| RAM (server) | 512 MB |
| RAM (client) | 512 MB |
| Storage | 1 GB + database |
| Ports | 3000 (client), 3001 (server), 5432 (PostgreSQL) |
