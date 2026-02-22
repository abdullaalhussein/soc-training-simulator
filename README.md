# SOC Training Simulator

**A multi-role Security Operations Center (SOC) training platform with realistic simulated logs for hands-on cybersecurity education.**

<p dir="rtl" align="right"><strong>محاكي تدريب مركز العمليات الأمنية</strong> — منصة تدريب متعددة الأدوار لمحللي الأمن السيبراني</p>

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Express](https://img.shields.io/badge/Express-5-000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4-010101?logo=socket.io)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-66_tests-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)

> If you find this project useful, please consider giving it a star — it helps others discover it and motivates continued development.

---

## Overview

SOC Training Simulator provides a realistic environment for training cybersecurity analysts. Trainees investigate multi-stage scenarios by analyzing simulated security logs, collecting evidence, writing YARA rules, and submitting incident reports — all while trainers monitor progress in real-time.

### Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Manage users, scenarios, audit logs, system settings |
| **Trainer** | Create sessions, monitor trainees live, send hints, adjust scores |
| **Trainee** | Investigate scenarios, analyze logs, submit evidence & reports |

### Key Features

- **Multi-stage scenario investigation** with configurable unlock conditions
- **10 realistic log types** — SIEM, EDR, Sysmon, Firewall, DNS, Network Flow, Proxy, Windows Event, Auth, Email Gateway
- **8 checkpoint types** — True/False, Multiple Choice, Severity Classification, Recommended Action, Short Answer, Evidence Selection, Incident Report, YARA Rule
- **YARA rule writing & testing** with real-time compilation against samples
- **Real-time trainer monitoring** via Socket.io (hints, alerts, pause/resume, chat)
- **5-dimension scoring system** — Accuracy (35%), Investigation (20%), Evidence (20%), Response (15%), Report (10%)
- **PDF & CSV report generation** with detailed score breakdowns
- **Scenario import/export** via JSON for sharing between instances
- **Live discussion panel** for trainer-trainee communication
- **Trainee-initiated attempts** — scenario timer starts only when the trainee clicks "Start", not when assigned
- **Light/dark mode toggle** — optimized for SOC environments; switch to dark mode for dimly lit rooms

---

## Screenshots

### Landing Page
<p align="center">
  <img src="docs/screenshots/00-landing.png" alt="Landing Page" width="720" />
</p>

### Login
<p align="center">
  <img src="docs/screenshots/01-login.png" alt="Login Page" width="720" />
</p>

### Admin Panel — User Management
<p align="center">
  <img src="docs/screenshots/02-admin-users.png" alt="Admin User Management" width="720" />
</p>

### Admin Panel — Scenario Management
<p align="center">
  <img src="docs/screenshots/03-admin-scenarios.png" alt="Admin Scenario Management" width="720" />
</p>

### Trainer Console — Session Management
<p align="center">
  <img src="docs/screenshots/05-trainer-console.png" alt="Trainer Console" width="720" />
</p>

### Trainee Dashboard
<p align="center">
  <img src="docs/screenshots/07-trainee-dashboard.png" alt="Trainee Dashboard" width="720" />
</p>

### Pre-Investigation Lesson
<p align="center">
  <img src="docs/screenshots/08-trainee-lesson.png" alt="Pre-Investigation Lesson" width="720" />
</p>

### Investigation Workspace — Log Viewer, Evidence Basket & Briefing
<p align="center">
  <img src="docs/screenshots/09-trainee-investigation.png" alt="Investigation Workspace" width="720" />
</p>

### Dark Mode

<p align="center">
  <img src="docs/screenshots/03-admin-scenarios-dark.png" alt="Admin Scenarios — Dark Mode" width="720" />
</p>
<p align="center">
  <img src="docs/screenshots/07-trainee-dashboard-dark.png" alt="Trainee Dashboard — Dark Mode" width="720" />
</p>

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Client** | Next.js 15, React 19, Tailwind CSS, Radix UI, Zustand, TanStack Query, next-themes, Recharts, Axios |
| **Server** | Express 5, Socket.io, JWT Auth, RBAC, Prisma ORM, Zod, PDFKit, Winston, YARA |
| **Database** | PostgreSQL 16, Prisma ORM (13 models, 7 enums) |
| **Testing** | Playwright (66 E2E tests across 16 spec files) |
| **DevOps** | Docker (multi-stage builds), Railway.app, docker-compose |

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
│   ├── src/middleware/       # Auth, RBAC, audit logging
│   ├── src/services/        # Scoring, YARA, PDF reports
│   └── src/socket/          # Socket.io namespaces (/trainer, /trainee)
├── shared/                  # Shared TypeScript types & constants
│   └── src/types/           # Enums, interfaces, validation
├── prisma/                  # Database schema & seed data
│   ├── schema.prisma        # 13 models, 7 enums
│   └── seed.ts              # Demo users & scenarios
├── scenarios/               # Importable scenario JSON files
├── e2e/                     # Playwright E2E tests (66 tests)
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

## Getting Started

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

# 4. Push schema & seed demo data
npm run db:push
npm run db:seed

# 5. Start development servers
npm run dev
#   Client → http://localhost:3000
#   Server → http://localhost:3001
```

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@soc.local` | `Password123!` |
| Trainer | `trainer@soc.local` | `Password123!` |
| Trainee | `trainee@soc.local` | `Password123!` |

> **SECURITY WARNING:** These are demo credentials for local development only. **Change all default passwords immediately** before deploying to any network-accessible environment. The server will log warnings on startup if default credentials are detected.

---

## Environment Variables

Create a `.env` file from [`.env.example`](.env.example):

```env
# Database
DATABASE_URL="postgresql://soc_admin:soc_password_2024@localhost:5433/soc_training?schema=public"

# JWT Authentication
JWT_SECRET="your-jwt-secret-change-in-production"
JWT_EXPIRES_IN="24h"
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
npm run db:seed              # Seed demo users & scenarios
npm run db:migrate           # Run Prisma migrations
npm run db:studio            # Open Prisma Studio GUI

# Testing
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
| `POST /api/auth/login` | User login | Public |
| `POST /api/auth/refresh` | Refresh JWT token | Public |
| `GET /api/auth/me` | Current user profile | Authenticated |
| `GET/POST /api/users` | User management | Admin |
| `GET/POST /api/scenarios` | Scenario CRUD | Admin, Trainer |
| `POST /api/scenarios/import` | Import scenario from JSON | Admin, Trainer |
| `GET/POST /api/sessions` | Session lifecycle | Admin, Trainer |
| `PUT /api/sessions/:id/status` | Pause/resume/end session | Admin, Trainer |
| `POST /api/attempts/start` | Start an attempt | Trainee |
| `POST /api/attempts/:id/answers` | Submit checkpoint answer | Trainee |
| `GET /api/logs/attempt/:id` | Filtered log retrieval | Trainee |
| `POST /api/yara/test` | Test YARA rule | Trainee |
| `GET /api/reports/attempt/:id/pdf` | PDF report | Admin, Trainer |
| `GET /api/reports/session/:id/csv` | CSV export | Admin, Trainer |

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

The project includes a comprehensive **Playwright E2E test suite** with 66 tests across 16 spec files covering all three roles.

```bash
npm run test:e2e             # Run all tests (headless Firefox)
npm run test:e2e:ui          # Interactive Playwright UI
npm run test:e2e:headed      # Run in visible browser
```

| Area | Tests | Coverage |
|------|-------|----------|
| **Auth** | 8 | Login, invalid credentials, redirects, RBAC enforcement |
| **Admin** | 16 | User CRUD, scenario management, audit log, settings |
| **Trainer** | 23 | Console (create/launch/pause/resume/end sessions), session monitor, reports, scenario guide, discussion chat, toast notifications, broadcast alerts |
| **Trainee** | 10 | Dashboard stats, session cards, investigation workspace, log search, evidence collection, checkpoints |
| **Shared** | 9 | Theme toggle, sidebar navigation, logout for all roles |

Tests run against a deployed instance by default (`E2E_BASE_URL` / `E2E_API_URL` env vars) or locally with `webServer` auto-start. Auth tokens are set up via a global setup that writes `storageState` files per role.

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

Pushing to `master` automatically deploys both server and client to Railway via GitHub Actions (`.github/workflows/deploy.yml`). Requires these repository secrets:

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

Need SSO, managed hosting, custom scenarios, or dedicated support for your organization? Reach out — we're happy to discuss enterprise options.

**Contact:** [abdullaalhussein@gmail.com](mailto:abdullaalhussein@gmail.com)

---

## Contributing

Contributions are welcome! Please read the [Contributor License Agreement](CLA.md) before submitting a pull request.

---

## License

This project is licensed under the [MIT License](LICENSE).
