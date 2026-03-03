# Threat Model — SOC Training Simulator

| Field | Value |
|-------|-------|
| **Methodology** | STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) |
| **Last Updated** | 2026-03-03 |
| **Scope** | Server, client, WebSocket layer, AI integrations, YARA execution engine |
| **Maintainer** | Abdullah Al-Hussein |

This document catalogs known threats, implemented mitigations, and residual risks for the SOC Training Simulator platform. Independent security assessments and responsible disclosure are welcome — please open a GitHub issue or contact the maintainer directly.

---

## Architecture Overview

### Trust Boundary Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UNTRUSTED ZONE                               │
│                                                                     │
│   ┌──────────┐    HTTPS / WSS     ┌───────────────────────────┐    │
│   │  Browser  │ ◄════════════════► │     Express Server        │    │
│   │ (Next.js) │   httpOnly cookies │     (Node.js)             │    │
│   └──────────┘   JWT + CSRF token  │                           │    │
│                                    │  ┌─────────────────────┐  │    │
│                                    │  │  Socket.io Server    │  │    │
│                                    │  │  /trainer  /trainee  │  │    │
│                                    │  └─────────────────────┘  │    │
│                                    └─────────┬──┬──┬──────────┘    │
│                                              │  │  │               │
│                        ┌─────────────────────┘  │  └────────────┐  │
│                        ▼                        ▼               ▼  │
│               ┌──────────────┐      ┌──────────────┐  ┌─────────┐ │
│               │ PostgreSQL   │      │ Anthropic AI │  │  YARA   │ │
│               │ (Prisma ORM) │      │ Claude API   │  │ Engine  │ │
│               └──────────────┘      └──────────────┘  └─────────┘ │
│                                                                     │
│                         TRUSTED ZONE                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Roles & Access

| Role | REST API | Socket Namespace | Capabilities |
|------|----------|------------------|--------------|
| **ADMIN** | All routes | `/trainer` | User management, scenario CRUD, session management, AI generation |
| **TRAINER** | Trainer + shared routes | `/trainer` | Session creation, trainee monitoring, reports, AI generation |
| **TRAINEE** | Trainee + shared routes | `/trainee` | Join sessions, investigate scenarios, use SOC Mentor |

### Data Classification

| Classification | Examples | Storage | Protection |
|----------------|----------|---------|------------|
| **Credentials** | Passwords, refresh tokens | PostgreSQL | bcrypt (12 rounds), SHA-256 hashed tokens |
| **Auth Tokens** | JWT access/refresh, CSRF | httpOnly cookies | HS256 signing, 4h/24h–7d expiry, token versioning |
| **PII** | Email, name | PostgreSQL | Role-based access, no client-side caching |
| **Investigation Data** | Attempt actions, scores, evidence | PostgreSQL | Per-user ownership checks, cross-attempt isolation |
| **AI Transcripts** | SOC Mentor conversations | PostgreSQL (`AiAssistantMessage`) | Per-attempt scoping, daily rate limits, audit logging |

---

## Attack Surfaces

| ID | Surface | Entry Point | Trust Level |
|----|---------|-------------|-------------|
| **A1** | Authentication | `POST /api/auth/login`, `POST /api/auth/refresh` | Unauthenticated |
| **A2** | REST API | All `/api/*` routes | Authenticated (role-gated) |
| **A3** | WebSocket | Socket.io `/trainer` and `/trainee` namespaces | Authenticated (cookie-based) |
| **A4** | AI System Prompts | SOC Mentor, AI scoring, scenario generation | Authenticated trainee/trainer input |
| **A5** | YARA Execution | Trainee-submitted YARA rules | Authenticated trainee input |
| **A6** | Scenario Content | Trainer/admin-authored scenario text injected into AI prompts | Authenticated trainer input (indirect injection) |
| **A7** | YARA Samples | Base64-encoded sample files for YARA matching | Scenario seed data |

---

## STRIDE Threat Analysis

### Spoofing

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **S-01** | A1 | Brute-force login | High | Mitigated | IP rate limit (15 req/15 min on auth routes); DB-backed account lockout after 5 failures for 15 minutes; failed attempts recorded in `RateLimitEntry` table |
| **S-02** | A1 | User enumeration via timing | Medium | Mitigated | Constant-time comparison using pre-computed dummy bcrypt hash (12 rounds) when user not found; identical error messages for invalid email and invalid password |
| **S-03** | A1 | JWT forgery / algorithm confusion | Critical | Mitigated | `algorithms: ['HS256']` explicitly enforced on all `jwt.verify()` calls; rejects `none` and RS256 algorithm substitution |
| **S-04** | A1 | Refresh token theft | High | Mitigated | Refresh tokens stored in `httpOnly`, `secure` (production), `sameSite` cookies; server stores only SHA-256 hash; atomic delete-before-reissue prevents race conditions |
| **S-05** | A1 | Session fixation via new device | Medium | Mitigated | Login history recorded in `UserLoginHistory` with IP and user agent; new-IP detection triggers server-side warning log; token version invalidation on password change |
| **S-06** | A1 | Default credential abuse in production | High | Mitigated | Production login blocked for demo credentials (`admin/trainer/trainee@soc.local`) unless `ALLOW_DEMO_CREDENTIALS=true`; startup warning if default passwords unchanged |
| **S-07** | A3 | WebSocket impersonation | High | Mitigated | Socket auth reads JWT exclusively from `httpOnly` cookie — no `auth.token` fallback; role checked on namespace connection (`/trainer` rejects non-TRAINER/ADMIN) |

### Tampering

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **T-01** | A2 | SQL injection | Critical | Mitigated | All database access via Prisma ORM (parameterized queries); no raw SQL; Zod validation on all request bodies |
| **T-02** | A2 | Request body manipulation | High | Mitigated | Zod schemas on all API routes strip unknown fields; body size limits enforced (JSON: 2 MB, URL-encoded: 100 KB) |
| **T-03** | A6 | Indirect prompt injection via scenario content | High | Mitigated | `sanitizePromptContent()` strips 38 injection patterns from scenario briefing, stage titles, and stage descriptions before AI prompt injection; AI-based injection risk scoring (`scoreInjectionRisk()`) on generated scenarios |
| **T-04** | A4 | Direct prompt injection via trainee messages | High | Mitigated | `filterAiInput()` checks 37 jailbreak patterns across 4 categories (role override, prompt extraction, answer extraction, jailbreak keywords); blocked messages saved for audit with `AI_JAILBREAK_BLOCKED` action |
| **T-05** | A2 | Cross-site request forgery | High | Mitigated | Double-submit CSRF pattern: `crypto.randomBytes(32)` token in client-readable cookie + `X-CSRF-Token` header; enforced on all state-changing methods (POST, PUT, PATCH, DELETE); login and refresh endpoints exempt (no cookie yet) |
| **T-06** | A3 | WebSocket event forgery | Medium | Mitigated | `progress-update` handler validates user is session member or creator; payload sanitized to expected fields only; message handler verifies sender authorization before DB write |

### Repudiation

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **R-01** | A2 | Untracked admin/trainer actions | Medium | Mitigated | `AuditLog` table records `LOGIN`, `LOGIN_FAILED`, `CHANGE_PASSWORD`, `AI_SCENARIO_GENERATE`, `SCENARIO_INJECTION_RISK`, `AI_JAILBREAK_BLOCKED`, `AI_OUTPUT_FILTERED` with userId, IP, action, resource, and details |
| **R-02** | A4 | Jailbreak attempts without evidence | Medium | Mitigated | Blocked messages saved to `AiAssistantMessage` table; `AI_JAILBREAK_BLOCKED` audit entry includes first 200 characters of message |
| **R-03** | A1 | Login denial | Medium | Mitigated | All login attempts (success and failure) recorded in `UserLoginHistory` with IP address and user agent; `LOGIN` and `LOGIN_FAILED` audit log entries |
| **R-04** | A5 | YARA execution without trace | Low | Partially Mitigated | YARA results returned to client; temp files cleaned up after execution. No persistent server-side execution log beyond attempt actions |

### Information Disclosure

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **I-01** | A4 | AI leaks checkpoint answers | Critical | Mitigated | 4-layer output filter: (1) answer-phrase pattern matching (12 patterns), (2) exact `correctAnswer` string detection, (3) fuzzy explanation text matching (60% threshold on significant words), (4) structured JSON data leak detection; checkpoint answers excluded from AI context; AI system prompt explicitly forbids answer revelation |
| **I-02** | A2 | Database errors leak schema details | High | Mitigated | `sanitizePrismaError()` maps Prisma error codes to generic messages (P2002→409, P2025→404, P2003/P2014→400, others→500); raw errors logged server-side only; stack traces excluded in production responses |
| **I-03** | A2 | Sensitive fields in API responses | Medium | Mitigated | Prisma `select` clauses limit returned fields; password hashes never included in query results |
| **I-04** | A4 | System prompt extraction | High | Mitigated | AI system prompt includes explicit anti-extraction rules; `filterAiInput()` blocks 7 prompt extraction patterns; `sanitizePromptContent()` strips extraction attempts from scenario content |
| **I-05** | A2 | Overly permissive CORS | Medium | Mitigated | `CORS_ORIGIN` environment variable restricts allowed origins; `frame-ancestors: 'none'` in CSP prevents clickjacking |

### Denial of Service

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **D-01** | A4 | AI API cost exhaustion | High | Mitigated | Per-user daily limit (default 30 messages via `AI_DAILY_LIMIT`); per-attempt cap (20 messages); org-wide daily cap (default 500 via `AI_DAILY_ORG_LIMIT`); AI concurrency semaphore (default 5 via `AI_MAX_CONCURRENT`); scenario generation limit (default 5/day via `AI_DAILY_SCENARIO_LIMIT`); token usage estimation and cost logging |
| **D-02** | A3 | WebSocket connection flood | High | Mitigated | Server-wide cap (default 500 via `SOCKET_MAX_CONNECTIONS`); per-user cap (3 concurrent connections); per-user shared rate limiter (30 events/10 seconds); stale rate-limit cleanup every 60 seconds |
| **D-03** | A2 | HTTP request flood | Medium | Mitigated | Global rate limit (200 req/min per IP); auth-specific rate limit (15 req/15 min per IP); body size limits (JSON: 2 MB, URL-encoded: 100 KB) |
| **D-04** | A5 | YARA ReDoS / resource exhaustion | High | Partially Mitigated | Execution timeout (5s production, 10s development); concurrency limiter (max 3 concurrent); static complexity analysis detects nested quantifiers, unbounded repetition (>10,000), excessive string definitions (>100), and excessive alternations (>50); rule size capped at 50,000 characters |
| **D-05** | A4 | Scenario generation abuse | Medium | Mitigated | Daily per-user limit (default 5); description input capped (10–2,000 chars via Zod); AI concurrency semaphore shared across all AI operations; SSE stream cancellation on client disconnect |

### Elevation of Privilege

| ID | Surface | Threat | Severity | Status | Mitigation |
|----|---------|--------|----------|--------|------------|
| **E-01** | A2 | RBAC bypass | Critical | Mitigated | `requireRole()` middleware on all protected routes; role checked from JWT payload after `authenticate` middleware; ADMIN-only, TRAINER-only, and combined role gates enforced per route |
| **E-02** | A2, A3 | Cross-attempt data access | High | Mitigated | Attempt ownership verified (`attempt.userId !== userId`) before AI assistant, checkpoint submission, and progress updates; session membership checked for trainer monitoring |
| **E-03** | A5 | YARA filesystem access | Critical | Mitigated | `include`/`import` directives stripped from rules; `execFile` (not `exec`) prevents shell injection; unique temp directory per execution (`/tmp/yara-{uuid}`); sample filename validated against `^[a-zA-Z0-9._-]+$`; temp files cleaned up in `finally` block |
| **E-04** | A1 | Token reuse after password change | High | Mitigated | `tokenVersion` embedded in JWT and checked on refresh; password change increments version and calls `logoutAll()`; WebSocket re-auth checks `tokenVersion` match every 5 minutes |

---

## Residual Risks

| ID | Threat Ref | Risk | Impact | Planned Mitigation |
|----|-----------|------|--------|-------------------|
| **RR-1** | D-04 | YARA ReDoS detection is heuristic-based — static analysis cannot catch all pathological patterns (e.g., deeply nested backreferences, complex lookaheads) | Medium — 5-second timeout caps worst case, but repeated submissions could consume all 3 YARA slots | Add runtime CPU monitoring; consider WASM-based YARA with memory limits |
| **RR-2** | T-03 | AI-generated scenario descriptions are sanitized before prompt injection but not before being stored — a trainer could craft scenario text that passes sanitization but exploits future prompt templates | Low — current `sanitizePromptContent()` covers 38 patterns and is applied at read time, not write time | Add write-time validation; structured dropdown injection (per advisory board) instead of free-text |
| **RR-3** | T-06 | WebSocket `progress-update` payload is sanitized to expected fields but numeric values (e.g., `currentStage`, `score`) are not bounds-checked against scenario constraints | Low — data is display-only in trainer view; no server-side state mutation from these values | Add numeric range validation against session scenario metadata |
| **RR-4** | T-04 | AI input filter (`filterAiInput`) matches against raw string without Unicode normalization — homoglyph substitution (e.g., Cyrillic "а" for Latin "a") could bypass pattern detection | Medium — attacker could evade jailbreak detection using visually similar Unicode characters | Add NFKC normalization before pattern matching; consider embedding-based semantic similarity check |
| **RR-5** | E-04 | WebSocket re-authentication runs on a 5-minute interval — a revoked token remains valid for up to 5 minutes on existing connections | Low — access token has its own 4-hour expiry; password change increments `tokenVersion` which the re-auth check validates | Reduce interval to 1–2 minutes; investigate server-push revocation via Redis pub/sub |
| **RR-6** | T-03 | `scan-content` endpoint returns `riskScore: 0` with explanation "scan skipped" when AI is unavailable — a misconfigured deployment could silently skip all injection scans | Low — scan is advisory (UI banner only); scenario content is still sanitized at prompt-injection time by `sanitizePromptContent()` | Return a distinct status code when scan is skipped; add client-side warning for skipped scans |

---

## Security Configuration

### Required Environment Variables

| Variable | Purpose | Validation |
|----------|---------|------------|
| `JWT_SECRET` | Signs access tokens (HS256) | Must be ≥32 characters; rejects `change-in-production` substring; throws on startup in production if invalid |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (HS256) | Same validation as `JWT_SECRET` |
| `DATABASE_URL` | PostgreSQL connection string | Required for Prisma; application will not start without valid connection |
| `CORS_ORIGIN` | Allowed origins for CORS and Socket.io | Comma-separated list; defaults to `http://localhost:3000` |

### Optional Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `JWT_EXPIRES_IN` | `4h` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime (overridden by role-based logic: 24h for admin/trainer) |
| `ANTHROPIC_API_KEY` | `''` (disabled) | Enables AI features; platform works fully without it |
| `AI_DAILY_LIMIT` | `30` | Per-user daily AI message cap |
| `AI_DAILY_ORG_LIMIT` | `500` | Organization-wide daily AI message cap (`0` = unlimited) |
| `AI_MAX_CONCURRENT` | `5` | Max parallel AI API calls (semaphore) |
| `AI_DAILY_SCENARIO_LIMIT` | `5` | Per-user daily scenario generation cap |
| `SOCKET_MAX_CONNECTIONS` | `500` | Server-wide WebSocket connection cap |
| `ALLOW_DEMO_CREDENTIALS` | `false` | Allows demo logins in production (must be literally `true`) |
| `CSP_REPORT_URI` | — | If set, adds `report-uri` directive to Content Security Policy |
| `NODE_ENV` | `development` | Controls secure cookie flags, stack trace exposure, YARA timeout |

### Production Hardening Checklist

- [ ] Set `JWT_SECRET` to a cryptographically random string ≥32 characters
- [ ] Set `JWT_REFRESH_SECRET` to a different cryptographically random string ≥32 characters
- [ ] Set `CORS_ORIGIN` to your exact frontend domain(s)
- [ ] Set `NODE_ENV=production` (enables secure cookies, disables stack traces)
- [ ] Leave `ALLOW_DEMO_CREDENTIALS` unset or `false`
- [ ] Set `DATABASE_URL` to a connection string with TLS (`?sslmode=require`)
- [ ] Configure `CSP_REPORT_URI` to collect Content Security Policy violations
- [ ] Review `AI_DAILY_LIMIT` and `AI_DAILY_ORG_LIMIT` for your organization size
- [ ] Ensure YARA binary is installed and accessible in `PATH` if YARA checkpoints are used

---

## Security Testing

### Automated Coverage

| Type | Count | Tool | CI |
|------|-------|------|----|
| Unit tests | 40 | Vitest | Yes (`ci.yml`) |
| E2E tests | 66 | Playwright | Yes (`ci.yml`) |
| Type checking | Full strict mode | TypeScript | Yes (`ci.yml`) |

### Unit Test Coverage (Security-Relevant)

| Module | Tests | What's Covered |
|--------|-------|----------------|
| `filterAiResponse` | Pattern matching, exact answer detection, fuzzy matching, JSON leak detection | All 4 filter layers with various bypass attempts |
| `scoring.service` | Score calculation, category weighting, edge cases | 5-category weighted scoring across all checkpoint types |

### Areas Without Automated Security Tests

- Jailbreak pattern bypass attempts (`filterAiInput`)
- Prompt sanitization effectiveness (`sanitizePromptContent`)
- YARA sandbox escape attempts
- WebSocket rate limiter under concurrent load
- CSRF double-submit validation
- Account lockout timing and reset behavior

### Vulnerability Reporting

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Contact the maintainer directly with details of the vulnerability
3. Include steps to reproduce, impact assessment, and suggested fix if possible
4. Allow reasonable time for a fix before public disclosure

---

## Dependency Security

### Key Security Dependencies

| Package | Purpose | Security Role |
|---------|---------|---------------|
| `bcryptjs` | Password hashing | 12 salt rounds; constant-time comparison |
| `jsonwebtoken` | JWT signing/verification | HS256 with explicit algorithm enforcement |
| `helmet` | HTTP security headers | CSP, X-Frame-Options, HSTS, X-Content-Type-Options |
| `express-rate-limit` | HTTP rate limiting | Global (200/min) and auth-specific (15/15min) limiters |
| `@prisma/client` | Database ORM | Parameterized queries; prevents SQL injection |
| `zod` | Input validation | Schema validation on all API request bodies |
| `cookie-parser` | Cookie parsing | Enables httpOnly cookie-based auth flow |
| `cors` | CORS enforcement | Origin whitelist from `CORS_ORIGIN` env var |

### Supply Chain Notes

- All dependencies installed via `npm` with `package-lock.json` for deterministic builds
- No `postinstall` scripts in first-party packages
- Prisma Client generated at build time (`prisma generate`)
- `npm audit` should be run periodically; consider integrating into CI pipeline
- YARA binary is a system-level dependency — ensure it comes from official distribution channels

---

## Document History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-03-03 | 1.0 | Abdullah Al-Hussein | Initial threat model — 21 STRIDE mitigations, 6 residual risks |
