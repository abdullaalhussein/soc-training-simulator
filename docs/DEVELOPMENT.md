# Development Guide

## Environment Variables

Create a `.env` file from [`.env.example`](../.env.example):

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
├── scenarios/               # 8 importable scenario JSON files (13 total via seed)
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

## Testing

### Unit Tests (Vitest)

```bash
cd server && npm test
```

96 tests covering the most critical paths:
- **Scoring Service** (30 tests) — all 8 checkpoint types, AI grading, fallback grading, edge cases, score recalculation
- **AI Output Filter** (22 tests) — all 4 filter layers (regex patterns, answer matching, explanation overlap, JSON leak detection)
- **CSRF Middleware** (21 tests) — token validation, cookie handling, exempt routes, error cases

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

## Adding Scenarios

### Import via API

```bash
curl -X POST http://localhost:3001/api/scenarios/import \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @scenarios/soc-fundamentals.json
```

Or use the Admin UI at `/scenarios`.

### Scenario JSON Format

Scenarios include top-level fields, a `stages[]` array with nested `logs[]` and `hints[]`, and a top-level `checkpoints[]` array (each with a `stageNumber` field). See the [`scenarios/`](../scenarios/) directory for examples.
