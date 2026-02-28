# SOC Training Simulator

**An open-source platform that prepares SOC analysts for real incidents before they face one.**

With a global shortage of 3.5 million cybersecurity professionals, most SOC training is either expensive, static, or disconnected from real investigation workflows. This platform closes that gap — free, self-hosted, and AI-powered.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5-000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude_AI-D4A574?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Vitest](https://img.shields.io/badge/Vitest-52_tests-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-68_tests-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

---

## Overview

SOC Training Simulator is a full-stack, multi-role platform for training cybersecurity analysts on realistic incident scenarios. Trainees investigate multi-stage attacks by analyzing simulated security logs, collecting evidence, writing YARA rules, and submitting incident reports — while trainers monitor progress in real-time and an AI-powered SOC Mentor guides learning.

### Demo

<p align="center">
  <video src="demo.mp4" controls width="720"></video>
</p>

> If the video doesn't load, [download demo.mp4](demo.mp4) or clone the repo to watch locally.

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <strong>Trainer Console</strong><br>
      <em>Create sessions, assign scenarios, monitor trainees in real-time</em>
      <br><br>
      <img src="docs/screenshots/05-trainer-console.png" alt="Trainer Console" width="100%" />
    </td>
    <td width="50%">
      <strong>Investigation Workspace</strong><br>
      <em>3-panel layout: briefing, log viewer with filters, evidence collection</em>
      <br><br>
      <img src="docs/screenshots/09-trainee-investigation.png" alt="Investigation Workspace" width="100%" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Scenario Management</strong><br>
      <em>13 built-in scenarios with MITRE ATT&amp;CK mapping and difficulty levels</em>
      <br><br>
      <img src="docs/screenshots/03-admin-scenarios.png" alt="Scenario Management" width="100%" />
    </td>
    <td width="50%">
      <strong>Trainee Dashboard</strong><br>
      <em>Track assigned sessions, progress stats, and start investigations</em>
      <br><br>
      <img src="docs/screenshots/07-trainee-dashboard.png" alt="Trainee Dashboard" width="100%" />
    </td>
  </tr>
</table>

<details>
<summary><strong>More screenshots</strong> (landing page, dark mode, lesson view)</summary>

#### Landing Page
<p align="center">
  <img src="docs/screenshots/00-landing.png" alt="Landing Page" width="720" />
</p>

#### Pre-Investigation Lesson
<p align="center">
  <img src="docs/screenshots/08-trainee-lesson.png" alt="Pre-Investigation Lesson" width="720" />
</p>

#### Dark Mode
<p align="center">
  <img src="docs/screenshots/03-admin-scenarios-dark.png" alt="Scenarios — Dark Mode" width="720" />
</p>
<p align="center">
  <img src="docs/screenshots/07-trainee-dashboard-dark.png" alt="Dashboard — Dark Mode" width="720" />
</p>

</details>

---

## Key Features

**Investigation & Training**
- **13 built-in scenarios** spanning Beginner to Advanced difficulty (phishing, brute force, lateral movement, DNS tunneling, APT campaigns, SQL injection, insider threat, YARA rules, SOC fundamentals)
- **Multi-stage scenario investigation** with configurable unlock conditions
- **10 realistic log types** — SIEM, EDR, Sysmon, Firewall, DNS, Network Flow, Proxy, Windows Event, Auth, Email Gateway
- **8 checkpoint types** — True/False, Multiple Choice, Severity Classification, Recommended Action, Short Answer, Evidence Selection, Incident Report, YARA Rule
- **Pre-investigation lessons** with markdown-rendered educational content

**AI-Powered (Bring Your Own Key)**
- **AI SOC Mentor** — context-aware assistant that guides trainees with Socratic questioning (never gives away answers)
- **AI Scoring** — Claude grades Short Answer and Incident Report checkpoints with detailed feedback
- **AI Scenario Generator** — create new scenarios from a text prompt with difficulty-scaled token budgets (Beginner/Intermediate/Advanced)
- **AI Security Scan** — automated injection risk detection on AI-generated scenario content
- **Server-side AI output filter** — 4-layer filter prevents the AI from leaking answers
- **Graceful degradation** — platform is fully functional without an API key; AI features show "unavailable" state

**Trainer Tools**
- **Real-time trainer monitoring** via Socket.io (hints, alerts, pause/resume, chat)
- **5-dimension scoring system** — Accuracy (35%), Investigation (20%), Evidence (20%), Response (15%), Report (10%)
- **PDF & CSV report generation** with detailed score breakdowns
- **Scenario import/export** via JSON for sharing between instances

**Security**
- **httpOnly cookie authentication** — access + refresh tokens stored in httpOnly cookies (never in localStorage)
- **CSRF double-submit pattern** — protects all state-changing requests
- **DB-backed account lockout** — 5 failed attempts triggers 15-minute lockout (survives server restarts)
- **Login anomaly detection** — warns on logins from new IP addresses
- **Answer resubmission prevention** — first answer is final, blocks answer harvesting exploits
- **Hint replay protection** — deduplicates hint requests to prevent score penalty stacking
- **AI prompt injection sanitizer** — 30 regex patterns strip known injection vectors from scenario content
- **Audit logging** — tracks login, password changes, attempt lifecycle, and security events
- **Content Security Policy** — Helmet.js with `frame-ancestors: 'none'` (clickjacking prevention)
- **Global + per-route rate limiting** — 200 req/min global, 15 req/15min on auth endpoints

**Platform**
- **YARA rule writing & testing** with real-time compilation against samples
- **Light/dark mode toggle** — optimized for SOC environments
- **Three roles** — Admin, Trainer, Trainee with full RBAC enforcement

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Manage users, scenarios, audit logs, system settings |
| **Trainer** | Create sessions, monitor trainees live, send hints, adjust scores |
| **Trainee** | Investigate scenarios, analyze logs, submit evidence & reports |

### How It Compares

| Feature | SOC Training Simulator | LetsDefend | TryHackMe | CyberDefenders |
|---------|----------------------|------------|-----------|----------------|
| Open source | Yes (MIT) | No | No | No |
| Self-hosted | Yes | No | No | No |
| AI Mentor / Scoring | Yes (Claude) | No | No | No |
| AI Scenario Generator | Yes | No | No | No |
| Custom scenarios | JSON import + AI generator | Limited | Community rooms | Limited |
| Real-time trainer monitoring | Yes (Socket.io) | No | No | No |
| YARA rule playground | Yes | No | No | No |
| MITRE ATT&CK mapping | Yes (searchable picker) | Partial | No | Yes |
| Multi-role (Admin/Trainer/Trainee) | Yes | Single user | Single user | Single user |
| Security hardening | CSRF, lockout, audit log, CSP | N/A | N/A | N/A |
| Cost | Free (BYOK for AI) | $25/mo+ | $14/mo+ | Free tier limited |

---

## Quick Start

> Setup takes approximately 5 minutes. Need help? Ask in [GitHub Discussions](https://github.com/abdullaalhussein/soc-training-simulator/discussions).

### Prerequisites

- **Node.js 20+**
- **Docker** (for PostgreSQL)
- **YARA 4.5+** (optional, for YARA checkpoint grading — included in Docker image)

### Local Setup

```bash
# 1. Clone & install
git clone https://github.com/abdullaalhussein/soc-training-simulator.git
cd soc-training-simulator
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start database (PostgreSQL on port 5433, pgAdmin on port 5050)
docker-compose up -d

# 4. Push schema & seed demo data (includes all 13 scenarios)
npm run db:push
npm run db:seed

# 5. Start development servers
npm run dev
#   Client → http://localhost:3000
#   Server → http://localhost:3001
```

### Quick Deploy (Railway)

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

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@soc.local` | `Password123!` |
| Trainer | `trainer@soc.local` | `Password123!` |
| Trainee | `trainee@soc.local` | `Password123!` |

> [!WARNING]
> These are demo credentials for local development only. **Change all default passwords immediately** before deploying to any network-accessible environment. The server will log warnings on startup if default credentials are detected.

### Production Security Checklist

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

## AI Features (Bring Your Own Key)

SOC Training Simulator integrates with [Anthropic's Claude API](https://www.anthropic.com/) for three optional AI features:

| Feature | What it does | Works without API key? |
|---------|-------------|----------------------|
| **SOC Mentor** | Context-aware chat assistant that guides trainees using Socratic questioning | No (shows "unavailable" state) |
| **AI Scoring** | Grades Short Answer and Incident Report checkpoints with detailed feedback | No (falls back to keyword matching) |
| **AI Scenario Generator** | Creates new scenarios from a text description, scaled by difficulty level | No (button disabled with tooltip) |
| **AI Security Scan** | Scans AI-generated content for prompt injection risks | No (disabled) |

**To enable AI features**, set your API key in `.env`:
```env
ANTHROPIC_API_KEY=your-api-key-here
AI_DAILY_LIMIT=30          # Max AI messages per user per day (default: 30)
AI_DAILY_ORG_LIMIT=500     # Organization-wide AI message cap (default: 500)
AI_MAX_CONCURRENT=5        # Max concurrent AI API calls (default: 5)
```

**Without an API key**, the platform is fully functional — all investigation, scoring (via deterministic methods), checkpoint, evidence, YARA, and reporting features work without AI. The SOC Mentor shows a clear "unavailable" state, and the AI scenario generator button is disabled with an explanatory tooltip.

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Client** | Next.js 15, React 19, Tailwind CSS, Radix UI, Zustand, TanStack Query, next-themes, Recharts, Axios |
| **Server** | Express 5, Socket.io, JWT Auth (httpOnly cookies), RBAC, CSRF, Prisma ORM, Zod, Helmet, PDFKit, Winston, YARA |
| **AI** | Anthropic Claude API (SOC Mentor, AI Scoring, Scenario Generator) |
| **Database** | PostgreSQL 16, Prisma ORM (13 models, 7 enums) |
| **Testing** | Vitest (52 unit tests), Playwright (68 E2E tests across 22 spec files) |
| **DevOps** | Docker (multi-stage builds), Railway.app, GitHub Actions CI |

---

## Project Structure

```
soc-training-simulator/
├── client/                  # Next.js 15 frontend
│   ├── src/app/
│   │   ├── (auth)/          # Login pages
│   │   ├── (admin)/         # Admin panel (users, scenarios, audit)
│   │   ├── (trainer)/       # Trainer console (sessions, monitoring, reports)
│   │   └── (trainee)/       # Investigation UI (log viewer, evidence, checkpoints)
│   ├── src/components/      # Reusable UI components
│   ├── src/hooks/           # Custom React hooks
│   └── src/stores/          # Zustand stores
├── server/                  # Express 5 backend
│   ├── src/routes/          # API route handlers
│   ├── src/middleware/       # Auth, RBAC, CSRF, error handling
│   ├── src/services/        # Scoring, AI, YARA, PDF reports
│   ├── src/utils/           # AI output filter, prompt sanitizer, logger
│   └── src/socket/          # Socket.io namespaces (/trainer, /trainee)
├── shared/                  # Shared TypeScript types & constants
│   └── src/types/           # Enums, interfaces, validation
├── prisma/                  # Database schema & seed data
│   ├── schema.prisma        # 13 models, 7 enums
│   └── seed.ts              # Demo users & all 13 scenarios
├── scenarios/               # 8 importable scenario JSON files
├── e2e/                     # Playwright E2E tests (68 tests)
│   ├── auth/                # Login, RBAC, redirect tests
│   ├── admin/               # User, scenario, audit, settings tests
│   ├── trainer/             # Console, monitor, chat, notifications, reports tests
│   ├── trainee/             # Dashboard, investigation tests
│   ├── shared/              # Theme, navigation, logout tests
│   ├── fixtures/            # Auth setup & test data
│   └── pages/               # Page object models
├── docker-compose.yml       # Local PostgreSQL + pgAdmin
└── docs/
    └── presentation.html    # Project architecture presentation
```

---

## Environment Variables

Create a `.env` file from [`.env.example`](.env.example):

```env
# Database (local dev defaults — change in production)
DATABASE_URL="postgresql://soc_admin:soc_password_2024@localhost:5433/soc_training?schema=public"

# JWT Authentication
JWT_SECRET="your-jwt-secret-change-in-production"
JWT_EXPIRES_IN="4h"
JWT_REFRESH_SECRET="your-refresh-secret-change-in-production"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
SERVER_PORT=3001
NODE_ENV=development

# Client (build-time, visible in browser)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001

# CORS
CORS_ORIGIN=http://localhost:3000

# AI Features (optional — platform works fully without these)
ANTHROPIC_API_KEY=
AI_DAILY_LIMIT=30
AI_DAILY_ORG_LIMIT=500
AI_MAX_CONCURRENT=5

# Security (production)
ALLOW_DEMO_CREDENTIALS=false
CSP_REPORT_URI=
SOCKET_MAX_CONNECTIONS=500
```

---

## Available Scripts

```bash
# Development
npm run dev                  # Run client + server concurrently
npm run dev -w client        # Client only (port 3000)
npm run dev -w server        # Server only (port 3001)

# Build
npm run build                # Build shared → server → client

# Database
npm run db:push              # Push Prisma schema to database
npm run db:seed              # Seed demo users & all 13 scenarios
npm run db:migrate           # Run Prisma migrations
npm run db:studio            # Open Prisma Studio GUI

# Testing
npm run test -w server       # Run unit tests (Vitest)
npm run test:e2e             # Run all E2E tests (headless)
npm run test:e2e:ui          # Open Playwright UI for interactive debugging
npm run test:e2e:headed      # Run tests in headed browser

# Docker
docker-compose up -d         # Start PostgreSQL + pgAdmin
docker-compose down          # Stop services
```

---

## API Endpoints

| Endpoint | Description | Access |
|----------|-------------|--------|
| `POST /api/auth/login` | User login (rate-limited, lockout-protected) | Public |
| `POST /api/auth/refresh` | Refresh JWT token (httpOnly cookie rotation) | Public |
| `POST /api/auth/logout` | Logout and revoke refresh token | Authenticated |
| `POST /api/auth/change-password` | Change password (invalidates all sessions) | Authenticated |
| `GET /api/auth/me` | Current user profile | Authenticated |
| `GET/POST /api/users` | User management | Admin |
| `GET/POST /api/scenarios` | Scenario CRUD | Admin, Trainer |
| `POST /api/scenarios/import` | Import scenario from JSON | Admin, Trainer |
| `POST /api/scenarios/generate` | AI-generate scenario from prompt | Admin, Trainer |
| `GET/POST /api/sessions` | Session lifecycle | Admin, Trainer |
| `PUT /api/sessions/:id/status` | Pause/resume/end session | Admin, Trainer |
| `POST /api/attempts/start` | Start an attempt | Trainee |
| `POST /api/attempts/:id/answers` | Submit checkpoint answer (one submission per checkpoint) | Trainee |
| `POST /api/attempts/:id/hints` | Request hint (deduplicated, single penalty) | Trainee |
| `GET /api/logs/attempt/:id` | Filtered log retrieval | Trainee |
| `POST /api/yara/test` | Test YARA rule | Trainee |
| `GET /api/ai/status` | Check AI availability | Authenticated |
| `POST /api/ai/scan-content` | Scan content for injection risk | Admin, Trainer |
| `GET /api/reports/attempt/:id/pdf` | PDF report | Admin, Trainer |
| `GET /api/reports/session/:id/csv` | CSV export | Admin, Trainer |
| `GET /api/security/audit-logs` | Security audit log viewer | Admin |

---

## Real-Time Events (Socket.io)

### `/trainer` namespace
| Event | Description |
|-------|-------------|
| `join-session` | Join session monitoring room |
| `send-hint` | Send hint to specific trainee |
| `send-session-alert` | Broadcast alert to all trainees |
| `pause-session` / `resume-session` | Control session state |
| `send-session-message` | Discussion chat |

### `/trainee` namespace
| Event | Description |
|-------|-------------|
| `join-attempt` | Join attempt room |
| `join-session` | Join session room |
| `progress-update` | Send progress to trainers |
| `ai-assistant-message` | Send message to SOC Mentor |
| `send-session-message` | Discussion chat |

---

## Scoring System

| Category | Weight | Method |
|----------|--------|--------|
| **Accuracy** | 35% | Checkpoint correctness (True/False, MC, Severity) |
| **Investigation** | 20% | Search diversity, filter usage, log depth, timeline building |
| **Evidence** | 20% | F1 score of selected vs correct evidence (precision & recall) |
| **Response** | 15% | Recommended action checkpoint accuracy |
| **Report** | 10% | Incident report keyword coverage + recommendations |

**Adjustments:** -5 points per hint used, trainer manual adjustment with notes.

---

## Testing

### Unit Tests (Vitest)

```bash
cd server && npm test
```

52 tests covering the two most critical paths:
- **Scoring Service** (30 tests) — all 8 checkpoint types, AI grading, fallback grading, edge cases, score recalculation
- **AI Output Filter** (22 tests) — all 4 filter layers (regex patterns, answer matching, explanation overlap, JSON leak detection)

### E2E Tests (Playwright)

```bash
npm run test:e2e             # Run all tests (headless Firefox)
npm run test:e2e:ui          # Interactive Playwright UI
npm run test:e2e:headed      # Run in visible browser
```

| Area | Spec Files | Coverage |
|------|------------|----------|
| **Auth** | 2 | Login, invalid credentials, redirects, RBAC enforcement |
| **Admin** | 5 | User CRUD, scenario management, audit log, settings |
| **Trainer** | 8 | Console (create/launch/pause/resume/end sessions), session monitor, reports, scenario guide, discussion chat, toast notifications, broadcast alerts |
| **Trainee** | 3 | Dashboard stats, session cards, investigation workspace, log search, evidence collection, checkpoints |
| **Shared** | 4 | Theme toggle, sidebar navigation, logout for all roles |

---

## Deployment

### Docker

Multi-stage Dockerfiles for both [server](server/Dockerfile) and [client](client/Dockerfile):

```bash
# Build server image (includes YARA binary)
docker build -t soc-server ./server

# Build client image (Next.js standalone)
docker build -t soc-client ./client \
  --build-arg NEXT_PUBLIC_API_URL=https://your-server.example.com \
  --build-arg NEXT_PUBLIC_WS_URL=https://your-server.example.com
```

### Railway.app

Deploy 3 services on [Railway](https://railway.app):

1. **PostgreSQL** — Railway plugin (auto-provisions `DATABASE_URL`)
2. **Server** — Uses `server/Dockerfile`, set JWT secrets & CORS origin
3. **Client** — Uses `client/Dockerfile`, set `NEXT_PUBLIC_API_URL` & `NEXT_PUBLIC_WS_URL` as build args

**Important:** `JWT_SECRET` and `JWT_REFRESH_SECRET` are required — the server will not start without them. Set `CORS_ORIGIN` to your client's Railway URL (e.g. `https://your-client.up.railway.app`).

### CI/CD

GitHub Actions runs on every push/PR to `master`:
- **Unit tests** — 52 tests via Vitest (scoring service + AI output filter)
- **Type checking** — server and client `tsc --noEmit`
- **Deployment** — auto-deploys to Railway on push to `master` (requires repository secrets)

| Secret | Description |
|--------|-------------|
| `RAILWAY_API_TOKEN` | Railway account API token (Account → Tokens) |
| `RAILWAY_PROJECT_ID` | Railway project ID |
| `RAILWAY_SERVER_SERVICE_ID` | Service ID for the server |
| `RAILWAY_CLIENT_SERVICE_ID` | Service ID for the client |

### Minimum Requirements

| Resource | Spec |
|----------|------|
| CPU | 1 vCPU |
| RAM (server) | 512 MB |
| RAM (client) | 512 MB |
| Storage | 1 GB + database |
| Ports | 3000 (client), 3001 (server), 5432 (PostgreSQL) |

---

## Adding Content

### Import a Scenario

```bash
# Via API
curl -X POST http://localhost:3001/api/scenarios/import \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @scenarios/soc-fundamentals.json
```

Or use the Admin UI at `/scenarios`.

### Scenario JSON Format

Scenarios include top-level fields, a `stages[]` array with nested `logs[]` and `hints[]`, and a top-level `checkpoints[]` array (each with a `stageNumber` field). See the [`scenarios/`](scenarios/) directory for examples.

---

## Documentation

Open [`docs/presentation.html`](docs/presentation.html) in a browser for the full architecture & implementation presentation (14 slides, bilingual EN/AR, arrow key navigation).

---

## Enterprise & Custom Deployments

For organizations that need more than the open-source edition:

- **Managed cloud hosting** — fully provisioned instance, no setup required
- **SSO / SAML integration** — connect to your organization's identity provider
- **Custom scenario development** — tailored training content for your threat landscape
- **Dedicated support & SLA** — priority response for your team

**Contact:** [abdullaalhussein@gmail.com](mailto:abdullaalhussein@gmail.com)

---

## Vision

Our goal is to become the open-source standard for SOC analyst training — free, extensible, and community-driven. We believe every security team deserves access to realistic, AI-powered training, regardless of budget.

---

## Community

Questions, ideas, or feedback? Join the conversation:

- [GitHub Discussions](https://github.com/abdullaalhussein/soc-training-simulator/discussions) — ask questions, share setups, suggest features
- [GitHub Issues](https://github.com/abdullaalhussein/soc-training-simulator/issues) — report bugs or request features

## Contributing

Contributions are welcome! Please read the [Contributor License Agreement](CLA.md) before submitting a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).

<p dir="rtl" align="right"><strong>محاكي تدريب مركز العمليات الأمنية</strong> — منصة تدريب متعددة الأدوار لمحللي الأمن السيبراني</p>

> If you find this project useful, please consider giving it a star — it helps others discover it and motivates continued development.
