# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SOC (Security Operations Center) Training Simulator — a multi-role platform for teaching cybersecurity analysts to investigate incidents using realistic simulated logs. Built as a monorepo with 4 npm workspaces: `client`, `server`, `shared`, `prisma`.

## Common Commands

```bash
npm install                  # Install all workspaces (runs prisma generate via postinstall)
npm run dev                  # Run client (port 3000) + server (port 3001) concurrently
npm run build                # Build shared → server → client
npm run db:push              # Push Prisma schema to database
npm run db:seed              # Seed with sample users and scenarios
npm run db:studio            # Open Prisma Studio GUI
npm run db:migrate           # Run Prisma migrations
```

Docker (local PostgreSQL on port 5433):
```bash
docker-compose up -d         # Start PostgreSQL + pgAdmin
```

Individual workspaces:
```bash
npm run dev -w client        # Next.js dev server (port 3000)
npm run dev -w server        # Express dev server with tsx watch (port 3001)
npm run build -w server      # TypeScript compile server
npm run lint -w client       # Lint client
```

## Architecture

### Server (`server/src/`)
- **Express 5** + **Socket.io** on port 3001
- Routes: `auth`, `users`, `scenarios`, `sessions`, `attempts`, `logs`, `reports`, `yara`, session messages
- Middleware chain: `helmet → cors → json(10MB) → authenticate (JWT) → requireRole → auditLog → handler`
- Services: `AuthService` (bcrypt/JWT), `ScoringService`, `PdfReportService`, `YaraService` (shells out to system `yara` binary)
- Socket.io namespaces: `/trainer` and `/trainee` for real-time session events (progress, hints, score adjustments, discussion messages)

### Client (`client/src/`)
- **Next.js 15** App Router with **React 19**
- Route groups by role: `(auth)/login`, `(admin)/*`, `(trainer)/*`, `(trainee)/*`
- The main trainee workspace is at `(trainee)/scenario/[attemptId]` — multi-tab investigation UI with log viewer, evidence basket, timeline, checkpoint modals
- State: **Zustand** for auth (`authStore`), **TanStack Query** for server state
- UI: Shadcn/Radix components in `components/ui/`, Tailwind CSS
- API client: Axios with JWT interceptor (`lib/api.ts`)

### Shared (`shared/src/`)
- TypeScript enums, interfaces, constants, and validation shared between client and server
- Score weights: accuracy 35%, investigation 20%, evidence 20%, response 15%, report 10%

### Database (Prisma + PostgreSQL)
- Schema at `prisma/schema.prisma`
- Key models: User → Session → Attempt → Answer/InvestigationAction; Scenario → ScenarioStage → SimulatedLog/Hint; Checkpoint
- 3 roles: ADMIN, TRAINER, TRAINEE
- 10 log types: WINDOWS_EVENT, SYSMON, EDR_ALERT, NETWORK_FLOW, SIEM_ALERT, FIREWALL, PROXY, DNS, EMAIL_GATEWAY, AUTH_LOG
- 8 checkpoint types: TRUE_FALSE, MULTIPLE_CHOICE, SEVERITY_CLASSIFICATION, RECOMMENDED_ACTION, SHORT_ANSWER, EVIDENCE_SELECTION, INCIDENT_REPORT, YARA_RULE

## Environment Variables

Required in `.env` (see `.env.example`):
```
DATABASE_URL=postgresql://...    # Railway injects this automatically
JWT_SECRET=...                   # For token signing
JWT_REFRESH_SECRET=...
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
CORS_ORIGIN=http://localhost:3000
```

Default seed credentials: `admin@soc.local`, `trainer@soc.local`, `trainee@soc.local` — all use `Password123!`

## Deployment

- **Railway.app** with 3 services: server, client, Postgres
- Server Dockerfile: `server/Dockerfile` (Node 20 Alpine + yara binary, runs `prisma db push` on start)
- Client Dockerfile: `client/Dockerfile` (Next.js standalone output)
- CORS auto-allows `*.railway.app` domains

## Scenario JSON Format

Importable scenario files live in `scenarios/`. The import API (`POST /api/scenarios/import`) expects:
- Top-level fields: `name`, `description`, `difficulty`, `category`, `briefing`, `lessonContent`, `estimatedMinutes`, etc.
- `stages[]` array with nested `logs[]` and `hints[]`
- `checkpoints[]` as a **top-level array** (not nested in stages) — each checkpoint has a `stageNumber` field to associate it with a stage

This is a critical distinction: the export format and the JSON files may show checkpoints inside stages, but the import API destructures `{ stages, checkpoints, ...scenarioData }` from the request body.
