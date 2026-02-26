# Contributing to SOC Training Simulator

Thank you for your interest in contributing to SOC Training Simulator! This guide covers everything you need to get started — from setting up your development environment to submitting a pull request.

## Table of Contents

- [Contributor License Agreement](#contributor-license-agreement)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Code Conventions](#code-conventions)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Where to Contribute](#where-to-contribute)
- [Reporting Issues](#reporting-issues)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Code of Conduct](#code-of-conduct)

---

## Contributor License Agreement

Before your pull request can be merged, you must read and agree to the [Contributor License Agreement (CLA)](CLA.md). By opening a PR, you confirm your agreement. The CLA grants the project maintainer the right to use your contribution in any form, including commercial offerings, while you retain ownership of your work.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Create a branch** from `master` for your changes
4. **Make your changes** following the conventions below
5. **Test** your changes (all tests must pass)
6. **Commit** with a clear message
7. **Push** to your fork and open a **Pull Request** against `master`

---

## Development Setup

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | 20+ | LTS recommended |
| **Docker** | Latest | For PostgreSQL |
| **YARA** | 4.5+ | Optional — only needed for YARA checkpoint grading |
| **Anthropic API Key** | — | Optional — AI features disabled without it |

### Install & Run

```bash
# Clone your fork
git clone https://github.com/<your-username>/soc-training-simulator.git
cd soc-training-simulator

# Install all workspace dependencies (client, server, shared, prisma)
npm install

# Copy environment template
cp .env.example .env

# Start PostgreSQL via Docker
docker-compose up -d

# Push Prisma schema to database
npm run db:push

# Seed demo users (admin/trainer/trainee) and all 13 scenarios
npm run db:seed

# Start development servers (client on :3000, server on :3001)
npm run dev
```

### Environment Variables

The `.env.example` file contains all configurable variables. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | See `.env.example` | PostgreSQL connection string |
| `JWT_SECRET` | — | Access token signing secret (32+ chars) |
| `JWT_REFRESH_SECRET` | — | Refresh token signing secret (32+ chars) |
| `JWT_EXPIRES_IN` | `4h` | Access token expiry |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed client origin |
| `ANTHROPIC_API_KEY` | — | Optional — enables AI features (BYOK) |
| `AI_DAILY_LIMIT` | `30` | Max AI messages per user per day |

### Demo Accounts

After seeding, three accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@soc.local` | `Password123!` |
| Trainer | `trainer@soc.local` | `Password123!` |
| Trainee | `trainee@soc.local` | `Password123!` |

### Useful Commands

```bash
npm run dev                  # Run client + server concurrently
npm run build                # Build shared -> server -> client
npm run db:push              # Push Prisma schema to database
npm run db:seed              # Seed demo users & all 13 scenarios
npm run db:studio            # Open Prisma Studio (database GUI)
cd server && npm test        # Run unit tests (Vitest)
npm run test:e2e             # Run Playwright E2E tests
npm run test:e2e:ui          # Run E2E tests with interactive UI
```

---

## Project Architecture

This is a **monorepo** managed with npm workspaces:

```
soc-training-simulator/
├── client/                  # Next.js 15 frontend (React 19, Zustand, TanStack Query)
│   └── src/
│       ├── app/             # Next.js App Router pages
│       │   ├── (admin)/     # Admin routes (users, scenarios, audit, settings)
│       │   ├── (trainer)/   # Trainer routes (console, sessions, reports, ai-review)
│       │   ├── (trainee)/   # Trainee routes (dashboard, scenario investigation)
│       │   └── (auth)/      # Login / signup
│       ├── components/      # Reusable React components
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # API client, utilities
│       └── store/           # Zustand state stores
├── server/                  # Express 5 backend (Socket.io, Prisma, Zod)
│   └── src/
│       ├── routes/          # REST API route handlers (11 files)
│       ├── services/        # Business logic (AI, scoring, auth, YARA, PDF)
│       ├── middleware/      # Auth, RBAC, rate limiting, validation
│       ├── socket/          # Socket.io namespaces (/trainer, /trainee)
│       ├── utils/           # AI filters, prompt sanitization, logger
│       ├── config/          # Server configuration
│       └── __tests__/       # Unit tests (Vitest)
├── shared/                  # Shared TypeScript types and constants
├── prisma/                  # Database schema + seed script
│   ├── schema.prisma        # 16 models, 7 enums
│   └── seed.ts              # Demo data seeder
├── scenarios/               # 13 scenario JSON files
├── e2e/                     # Playwright E2E test suites
├── docs/                    # HLD, LLD, Threat Model (MD + PDF)
└── .github/workflows/       # CI (unit tests + type check) + Deploy (Railway)
```

### Key Technologies

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI, Zustand, TanStack Query |
| **Backend** | Express 5, Socket.io, Prisma ORM, Zod, JWT (httpOnly cookies), Winston |
| **Database** | PostgreSQL 16 |
| **AI** | Anthropic Claude API (SOC Mentor, AI Scoring, Scenario Generator) |
| **Testing** | Vitest (unit), Playwright (E2E) |
| **CI/CD** | GitHub Actions, Railway |

### Data Flow

```
Browser (React SPA)
    │
    │  HTTPS + WSS (TLS)
    │  httpOnly cookies (accessToken + refreshToken + csrf)
    ▼
Express 5 Server
    │
    ├── Helmet / CORS / CSP ──► Security headers
    ├── Global Rate Limiter ──► 200 req/min per IP
    ├── CSRF Validation ──────► Double-submit cookie
    ├── JWT Auth ─────────────► httpOnly cookie + Bearer fallback
    ├── RBAC Middleware ──────► ADMIN / TRAINER / TRAINEE
    ├── Zod Validation ──────► Request body schemas
    │
    ├── REST API Routes ─────► CRUD operations
    ├── Socket.io ───────────► Real-time trainer monitoring
    ├── AI Service ──────────► Anthropic Claude API (5-layer defense)
    └── YARA Service ────────► Sandboxed rule execution
    │
    ▼
PostgreSQL 16 (Prisma ORM)
```

---

## Code Conventions

### TypeScript

- **Strict mode** everywhere — no `any` unless absolutely necessary
- Server uses **CommonJS** (`module: "commonjs"` in tsconfig)
- Client uses **ESM** (Next.js default)
- Shared types go in `shared/` workspace

### Server

- **Zod** for request validation on all API routes — define schemas alongside route handlers
- **RBAC** enforced via `authorize()` middleware — never skip role checks
- **Socket.io namespaces:** `/trainer` and `/trainee` — each has per-socket auth + rate limiting
- **Services** contain business logic — route handlers should be thin
- **Prisma** for all database access — never write raw SQL

### Client

- **Zustand** for global state (auth, socket connections)
- **TanStack Query** for server state (API data fetching and caching)
- **Tailwind CSS** for styling — follow existing class patterns
- **Radix UI** for accessible primitives — don't reinvent dialogs, dropdowns, etc.
- **`MarkdownRenderer`** component for any user-facing text that may contain markdown

### Security Rules (Non-Negotiable)

- Never expose `correctAnswer`, `explanation`, or `isEvidence` fields in trainee-facing API responses
- Never bypass the AI output filter — all AI responses must pass through `filterAiResponse()`
- Never store tokens in `localStorage` — use httpOnly cookies
- Never skip Zod validation on mutating routes
- Never run YARA rules without the sandboxing logic in `yara.service.ts`
- Always use parameterized queries (Prisma handles this) — no string interpolation in queries

### File Naming

- React components: `PascalCase.tsx` (e.g., `CheckpointModal.tsx`)
- Routes/services/utils: `kebab-case.ts` or `camelCase.ts` (follow existing patterns)
- Test files: `*.test.ts` in `__tests__/` directories

---

## Testing

### Unit Tests (Vitest)

```bash
# Run all unit tests
cd server && npm test

# Run in watch mode
cd server && npx vitest

# Run a specific test file
cd server && npx vitest filterAiResponse
```

Unit tests live in `server/src/__tests__/`. Current coverage includes:
- **AI output filter** — 4-layer filtering with regex, answer matching, overlap, and JSON detection
- **Scoring service** — 8 checkpoint types, F1 score calculation, keyword matching

When adding new server-side logic, add corresponding tests.

### E2E Tests (Playwright)

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with interactive UI
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e:headed

# Run a specific test suite
npx playwright test e2e/auth/
```

E2E tests require the full stack running (client + server + database). They cover:
- Authentication flows (login, signup, logout)
- Admin operations (user management, scenarios)
- Trainer workflows (session creation, monitoring)
- Trainee workflows (dashboard, investigation)

### Writing Tests

**Unit tests** should:
- Test a single function or service method
- Use descriptive `describe` / `it` blocks
- Cover happy paths, edge cases, and error conditions
- Not depend on external services (mock Anthropic API, database, etc.)

**E2E tests** should:
- Test complete user workflows, not individual components
- Use the Page Object pattern where possible
- Be independent — each test should set up its own state
- Clean up after themselves

### CI Pipeline

Every push and PR triggers the CI pipeline (`.github/workflows/ci.yml`):
1. **Unit Tests** — `cd server && npm test`
2. **Type Check** — `npx tsc --noEmit` for both client and server

All checks must pass before merging.

---

## Commit Guidelines

### Message Format

```
<imperative verb> <what changed>

<optional body — why, not what>
```

### Rules

- Use **imperative mood**: "Add feature" not "Added feature"
- Keep the first line **under 72 characters**
- Reference issue numbers where applicable: `Fix login redirect (#42)`
- Separate subject from body with a blank line
- Body should explain **why**, not repeat what the diff shows

### Examples

```
Add YARA rule validation for custom scenario checkpoints

Fix trainee dashboard showing incorrect attempt count

Refactor AI output filter to support configurable thresholds
```

---

## Pull Request Process

### Before Submitting

Ensure all of the following pass locally:

- [ ] Unit tests pass: `cd server && npm test`
- [ ] TypeScript compiles: `npm run build`
- [ ] E2E tests pass (if UI changed): `npm run test:e2e`
- [ ] No new security vulnerabilities introduced (see [Security Rules](#security-rules-non-negotiable))
- [ ] You have agreed to the [CLA](CLA.md)

### PR Requirements

1. **Title** — Short, descriptive, imperative (`Add ...`, `Fix ...`, `Refactor ...`)
2. **Description** — What changed and why. Include screenshots for UI changes.
3. **Test plan** — How the changes were tested (unit tests, E2E, manual)
4. **Breaking changes** — Call out any API, schema, or behavior changes

### Review Process

- PRs are reviewed by the maintainer
- Address review feedback by pushing new commits (don't force-push during review)
- Once approved, the maintainer will merge

### Database Migrations

If your changes modify `prisma/schema.prisma`:

1. Run `npm run db:push` locally to test
2. Include the schema change in your PR
3. Note the migration requirement in the PR description
4. **Do not** commit migration files — we use `db push` for schema sync

---

## Where to Contribute

### Good First Contributions

- **Scenario content** — Create new investigation scenarios in `scenarios/` (follow existing JSON structure)
- **Documentation** — Improve inline code comments, README sections, or architecture docs
- **Bug fixes** — Check the [Issues](https://github.com/abdullaalhussein/soc-training-simulator/issues) tab
- **Test coverage** — Add unit tests for untested services or utilities

### Areas Accepting Contributions

| Area | Description | Difficulty |
|------|-------------|------------|
| **Scenarios** | New investigation scenarios (JSON files) | Beginner |
| **UI/UX** | Accessibility improvements, mobile responsiveness | Beginner–Intermediate |
| **Tests** | Unit tests for services, E2E for new workflows | Intermediate |
| **Checkpoint types** | New challenge types (Sigma rules, KQL queries) | Advanced |
| **AI features** | SOC Mentor improvements, adaptive difficulty | Advanced |
| **Integrations** | Threat intel feeds, SIEM connectors | Advanced |

### Architecture Docs

Before working on larger changes, review:
- **[High-Level Design (HLD)](docs/HLD.md)** — System architecture, component interactions, design decisions
- **[Low-Level Design (LLD)](docs/LLD.md)** — API contracts, data models, implementation details
- **[Threat Model](docs/THREAT_MODEL.md)** — Security architecture, STRIDE analysis, trust boundaries

---

## Reporting Issues

- **Bugs** — Use the [Bug Report](https://github.com/abdullaalhussein/soc-training-simulator/issues/new?labels=bug) template
- **Feature requests** — Use the [Feature Request](https://github.com/abdullaalhussein/soc-training-simulator/issues/new?labels=enhancement) template
- **Questions** — Open a [Discussion](https://github.com/abdullaalhussein/soc-training-simulator/discussions)

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser / OS / Node.js version
5. Relevant logs or screenshots

---

## Security Vulnerabilities

**Do NOT open a public GitHub issue for security vulnerabilities.**

See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Report unacceptable behavior to [abdullaalhussein@gmail.com](mailto:abdullaalhussein@gmail.com).

---

## Questions?

Open a [Discussion](https://github.com/abdullaalhussein/soc-training-simulator/discussions) for questions, ideas, or general conversation. We're happy to help you get started!
