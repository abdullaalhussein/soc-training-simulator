# Security Policy

## Table of Contents

- [Supported Versions](#supported-versions)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Security Architecture Overview](#security-architecture-overview)
- [Authentication & Authorization](#authentication--authorization)
- [AI Security (5-Layer Defense)](#ai-security-5-layer-defense)
- [Rate Limiting & Abuse Prevention](#rate-limiting--abuse-prevention)
- [Infrastructure Security](#infrastructure-security)
- [YARA Execution Sandboxing](#yara-execution-sandboxing)
- [Data Protection](#data-protection)
- [Production Security Checklist](#production-security-checklist)
- [Threat Model](#threat-model)
- [Known Limitations](#known-limitations)

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.1.x (latest) | Yes |
| < 1.1 | No |

We only provide security patches for the latest version. Users on older versions should upgrade.

---

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Contact

Report vulnerabilities by emailing: **[abdullaalhussein@gmail.com](mailto:abdullaalhussein@gmail.com)**

### What to Include

| Field | Description |
|-------|-------------|
| **Summary** | Brief description of the vulnerability |
| **Reproduction** | Step-by-step instructions to reproduce |
| **Impact** | What an attacker could achieve (data exposure, privilege escalation, etc.) |
| **Affected components** | Which files, routes, or services are involved |
| **Suggested fix** | Optional — your recommended remediation |
| **STRIDE category** | Optional — Spoofing, Tampering, Repudiation, Info Disclosure, DoS, or Elevation of Privilege |

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 1 week |
| Fix development | Within 2 weeks of confirmation |
| Coordinated disclosure | Within 30 days |

We follow **responsible disclosure**. We will credit you in the release notes unless you prefer to remain anonymous.

### Scope

In scope:
- Authentication bypass or token theft
- Authorization flaws (accessing resources beyond your role)
- AI prompt injection leading to answer leakage or data exfiltration
- YARA execution sandbox escape
- SQL injection or data exposure
- Cross-site scripting (XSS) or cross-site request forgery (CSRF)
- Rate limiting bypass
- Information disclosure (stack traces, error details, internal paths)

Out of scope:
- Denial of service via volume attacks on infrastructure you don't own
- Social engineering of project maintainers
- Vulnerabilities in dependencies with no demonstrated exploit path
- Issues in the demo deployment that don't affect self-hosted instances

---

## Security Architecture Overview

SOC Training Simulator implements **defense-in-depth** across all layers. The server processes every request through a security middleware chain:

```
Request
  │
  ▼
┌──────────────────┐
│  Helmet          │  Security headers (CSP, HSTS, X-Frame-Options, etc.)
│  + CSP Reporting │  Violation reports sent to configurable endpoint
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Global Rate     │  200 requests/min per IP (all routes)
│  Limiter         │  Database-backed — survives restarts
└────────┬─────────┘
         ▼
┌──────────────────┐
│  CSRF Validation │  Double-submit cookie pattern
│                  │  X-CSRF-Token header vs csrf cookie
└────────┬─────────┘
         ▼
┌──────────────────┐
│  JWT Auth        │  httpOnly cookie (primary) + Bearer header (fallback)
│                  │  4h access token + 7d refresh token
└────────┬─────────┘
         ▼
┌──────────────────┐
│  RBAC Middleware  │  ADMIN / TRAINER / TRAINEE role enforcement
│                  │  Per-route + ownership checks
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Route-Level     │  Auth: 15/15min, AI: 30/day, YARA: 10/min
│  Rate Limiting   │  Logs: 100/min, Actions: 60/min, Socket: 30/10s
└────────┬─────────┘
         ▼
┌──────────────────┐
│  Zod Validation  │  Schema validation on all mutating routes
│                  │  Type coercion, enum enforcement, size limits
└────────┬─────────┘
         ▼
     Route Handler
```

Five **trust boundaries** are documented in the [Threat Model](docs/THREAT_MODEL.md):
1. Internet <-> Client (TLS)
2. Client <-> Server (HTTPS/WSS + cookies + CSRF)
3. Server <-> Database (Prisma ORM, parameterized queries)
4. Server <-> Anthropic API (HTTPS, API key server-side only)
5. Server <-> YARA/Filesystem (sandboxed execution)

---

## Authentication & Authorization

### Token Architecture

| Token | Storage | Expiry | Flags |
|-------|---------|--------|-------|
| **Access token** (JWT) | httpOnly cookie | 4 hours | httpOnly, sameSite=lax, secure (prod) |
| **Refresh token** | httpOnly cookie | 7 days | httpOnly, sameSite=lax, secure (prod) |
| **CSRF token** | Non-httpOnly cookie | Session | sameSite=lax, secure (prod) |

- Access tokens are **never stored in localStorage** — they live in httpOnly cookies inaccessible to JavaScript
- Bearer header is supported as a fallback for non-browser API clients
- Refresh token rotation: old token is deleted on every refresh

### Account Security

| Feature | Details |
|---------|---------|
| **Password policy** | 8+ characters, uppercase, lowercase, digit, special character |
| **Account lockout** | 5 failed login attempts triggers 15-minute exponential backoff (per-email) |
| **Default credential guard** | Demo credentials (`Password123!`) are blocked in production; `mustChangePassword` flag enforced |
| **Token revocation** | All refresh tokens deleted on: password change, role change, account deactivation |

### Role-Based Access Control (RBAC)

Three roles with strict middleware enforcement:

| Role | Capabilities |
|------|-------------|
| **ADMIN** | Full system access — user management, scenarios, audit logs, settings |
| **TRAINER** | Create/manage sessions, assign scenarios, monitor trainees, view reports, review AI conversations |
| **TRAINEE** | Join sessions, complete investigations, use SOC Mentor, view own results |

Every API route and Socket.io namespace enforces role checks. Ownership checks prevent horizontal privilege escalation (e.g., trainee A cannot access trainee B's attempt data).

---

## AI Security (5-Layer Defense)

The AI integration (Anthropic Claude API) is protected by five layers:

### Layer 1 — Input Filtering (`filterAiInput`)

Scans all user messages before they reach the AI API. Blocks ~30 known jailbreak patterns including:
- Role-play instructions ("ignore previous instructions", "you are now", "pretend you are")
- Prompt extraction attempts ("repeat your system prompt", "what are your instructions")
- Encoding bypass attempts (base64 decode requests, hex encoding)

Blocked messages are **audit-logged** with the matched pattern for trainer review.

### Layer 2 — Prompt Sanitization (`sanitizePrompt`)

Scenario content (created by trainers) is sanitized before injection into the AI system prompt:
- `sanitizePromptContent()` strips ~30 injection patterns from text fields
- `scanScenarioContent()` scans all scenario fields (briefing, stage descriptions, checkpoint questions) and logs any detected patterns

This prevents **indirect prompt injection** where a malicious trainer embeds instructions in scenario content.

### Layer 3 — System Prompt Hardening

The AI system prompt uses **Socratic questioning methodology** with explicit instructions:
- Never provide direct answers to checkpoint questions
- Never reveal correctAnswer, explanation, or scoring criteria
- Guide trainees through reasoning without giving away solutions
- Refuse requests that attempt to extract investigation answers

### Layer 4 — Output Filtering (`filterAiResponse`)

Every AI response passes through a 4-layer output filter before reaching the trainee:
1. **Phrase detection** — Regex patterns matching answer-giving language
2. **Answer matching** — Direct comparison against checkpoint `correctAnswer` values
3. **Explanation overlap** — Word overlap analysis (>60% threshold) against `explanation` fields
4. **JSON structure detection** — Catches leaked structured data (checkpoint objects, answer arrays)

Filtered responses are replaced with a safe Socratic redirect. Filter triggers are **audit-logged**.

### Layer 5 — Conversation Review

Trainers have access to an **AI Conversation Review** panel (`/ai-review`) showing:
- All AI conversations per trainee per attempt
- Anomaly flags: jailbreak attempts blocked, output filter triggers
- Full message history for manual review

### AI Rate Limiting

| Limit | Value |
|-------|-------|
| Messages per attempt | 20 |
| Messages per user per day | 30 (configurable via `AI_DAILY_LIMIT`) |
| Scenario generations per day | 5 per user |
| Max output tokens | 500 per response |
| Conversation history | 50 messages max |
| Token cost tracking | Logged per AI call |

---

## Rate Limiting & Abuse Prevention

### Rate Limit Tiers

| Tier | Limit | Scope | Routes |
|------|-------|-------|--------|
| **Global** | 200 req/min | Per IP | All routes |
| **Auth** | 15 req/15min | Per IP | Login, register, refresh |
| **AI** | 30 req/day | Per user | SOC Mentor messages |
| **YARA** | 10 req/min | Per IP | YARA rule submission |
| **Logs** | 100 req/min | Per IP | Log retrieval |
| **Actions** | 60 req/min | Per IP | Investigation actions |
| **Socket messages** | 30/10s | Per socket | WebSocket events |
| **Socket connections** | 3 | Per user | Concurrent WebSocket connections |
| **YARA concurrency** | 3 | Global | Simultaneous YARA executions (semaphore) |

Rate limit state is stored in the **database** (`RateLimitEntry` model), so limits survive server restarts.

### WebSocket Security

- **Authentication from cookie** — JWT parsed from handshake cookies (not query params)
- **Per-user connection limit** — Maximum 3 concurrent WebSocket connections per user
- **Periodic re-authentication** — JWT verified every 5 minutes; expired connections disconnected
- **Session membership validation** — `progress-update` events validated against session membership
- **Namespace isolation** — `/trainer` and `/trainee` namespaces with independent auth + rate limiting

---

## Infrastructure Security

### Security Headers (Helmet)

| Header | Value |
|--------|-------|
| **Content-Security-Policy** | `default-src 'self'`, `script-src 'self'`, `style-src 'self' 'unsafe-inline'` + CSP violation reporting |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains` |
| **X-Frame-Options** | `DENY` |
| **X-Content-Type-Options** | `nosniff` |
| **Referrer-Policy** | `strict-origin-when-cross-origin` |

CSP violation reports are sent to a configurable endpoint (`CSP_REPORT_URI` environment variable) for monitoring.

### CORS

- Origin whitelist configured via `CORS_ORIGIN` environment variable
- Credentials mode enabled (cookies)
- Methods restricted to `GET, POST, PUT, PATCH, DELETE`
- Preflight caching: 600 seconds

### Error Handling

- **Prisma error sanitization** — Database errors are mapped to generic HTTP responses:
  - `P2002` (unique constraint) -> `409 Conflict`
  - `P2025` (not found) -> `404 Not Found`
  - `P2003` (foreign key) -> `400 Bad Request`
  - `P2014` (relation violation) -> `400 Bad Request`
- Stack traces and internal paths are **never exposed** in production responses
- Database field names and model names are stripped from error messages

### Audit Logging

Comprehensive audit trail for security-relevant events:

| Event | Logged Data |
|-------|------------|
| `LOGIN_SUCCESS` / `LOGIN_FAILED` | User ID, IP, email |
| `ATTEMPT_START` / `ATTEMPT_COMPLETE` | Attempt ID, scenario, score |
| `YARA_TEST` | Rule hash, result, execution time |
| `AI_JAILBREAK_BLOCKED` | Matched pattern, user ID, message excerpt |
| `AI_OUTPUT_FILTERED` | Filter layer triggered, user ID |
| `SEND_HINT` | Trainer ID, recipient, hint content |
| CRUD operations | Entity type, action, user ID |

---

## YARA Execution Sandboxing

YARA rule testing (where trainees write and test detection rules) runs in a controlled environment:

| Control | Details |
|---------|---------|
| **Temp directories** | Each execution gets an isolated temp directory, cleaned up after |
| **Include/import stripping** | `include` and `import` statements removed before execution |
| **Execution timeout** | 10-second hard timeout via `child_process.execFile` |
| **Concurrency semaphore** | Maximum 3 simultaneous YARA executions globally |
| **Rate limiting** | 10 YARA submissions per minute per IP |
| **Audit logging** | Every execution logged with rule hash and result |
| **Binary validation** | Only the system `yara` binary is invoked — no arbitrary command execution |

---

## Data Protection

### Trainee Data Stripping

API responses to trainees are **stripped** of sensitive fields before transmission:
- `correctAnswer` — Removed from all checkpoint data
- `explanation` — Removed from all checkpoint data
- `isEvidence` — Removed from log entries (would reveal which logs are evidence)
- `evidenceTag` — Removed from log entries

This prevents trainees from inspecting API responses to find answers.

### Password Storage

All passwords are hashed with **bcrypt** using the default cost factor. Plaintext passwords are never stored or logged.

### Cookie Security

| Cookie | httpOnly | Secure | SameSite |
|--------|----------|--------|----------|
| `accessToken` | Yes | Yes (prod) | Lax |
| `refreshToken` | Yes | Yes (prod) | Lax |
| `csrf` | No (read by JS) | Yes (prod) | Lax |

### Request Body Limits

| Type | Limit |
|------|-------|
| JSON body | 2 MB |
| URL-encoded | 100 KB |
| Action details | 100 KB |

---

## Production Security Checklist

Before deploying to any network-accessible environment:

### Critical

- [ ] Change all default passwords (admin, trainer, trainee demo accounts)
- [ ] Set `NODE_ENV=production` (enables secure cookies, blocks demo credentials)
- [ ] Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET` (cryptographically random, 32+ characters)
- [ ] Configure `CORS_ORIGIN` to your exact client domain (no wildcards)
- [ ] Use HTTPS everywhere (required for httpOnly cookie transport)
- [ ] Restrict database access — PostgreSQL should not be publicly accessible
- [ ] Change the default Docker PostgreSQL password in `docker-compose.yml`

### Recommended

- [ ] Set `CSP_REPORT_URI` to a monitoring endpoint for CSP violation reports
- [ ] Review `AI_DAILY_LIMIT` for your user count and API budget
- [ ] Set up log aggregation for audit log entries
- [ ] Configure YARA binary path if not in system PATH
- [ ] Enable database connection pooling for production workloads
- [ ] Set up monitoring for rate limit triggers and lockout events
- [ ] Review and rotate JWT secrets periodically
- [ ] Back up the database regularly (refresh tokens, audit logs, attempt data)

### Environment Variables for Security

```bash
NODE_ENV=production                    # Enables secure cookies, blocks demo creds
JWT_SECRET=<random-32+-chars>          # Access token signing
JWT_REFRESH_SECRET=<random-32+-chars>  # Refresh token signing
JWT_EXPIRES_IN=4h                      # Access token expiry (lower = more secure)
JWT_REFRESH_EXPIRES_IN=7d              # Refresh token expiry
CORS_ORIGIN=https://your-domain.com    # Exact client origin
AI_DAILY_LIMIT=30                      # Per-user AI message cap
CSP_REPORT_URI=https://your-csp-report-endpoint  # Optional
```

---

## Threat Model

A comprehensive **STRIDE threat model** is maintained at **[docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)**, covering:

- **41 identified threats** across 6 STRIDE categories
- **5x5 risk matrix** (Likelihood x Impact = Risk Score)
- Detailed threat cards for all previously High-risk threats
- **25 security controls** mapped to STRIDE categories
- **21 of 23 mitigations implemented** (91% completion)

### Current Risk Posture (v1.1)

| Metric | Value |
|--------|-------|
| Critical-risk threats | **0** |
| High-risk threats | **0** |
| Medium-risk threats | 24 |
| Low-risk threats | 17 |
| Highest single threat score | 10/25 (vertical role escalation — inherent JWT risk) |
| Total risk score | 229/1025 (22%) |

Full architecture documentation:
- **[High-Level Design](docs/HLD.md)** — System architecture and design decisions
- **[Low-Level Design](docs/LLD.md)** — API contracts, data models, implementation details
- **[Threat Model](docs/THREAT_MODEL.md)** — STRIDE analysis and risk assessment

---

## Known Limitations

These are acknowledged security limitations, documented in the threat model with accepted risk rationale:

| Limitation | Risk | Rationale |
|-----------|------|-----------|
| `'unsafe-inline'` in CSP styleSrc | XSS via style injection (low risk) | Required by Tailwind CSS / Radix UI — removal blocked by framework dependency |
| AI has checkpoint answers in context | Answer leakage via prompt injection (mitigated) | 5-layer defense reduces risk to Medium; tool-calling architecture planned for future |
| 4-hour access token window after role change | Brief privilege persistence | Refresh tokens revoked immediately; 4h max exposure acceptable |
| YARA runs on host (not isolated container) | Resource exhaustion | Sandboxed with semaphore, timeout, and include stripping; container isolation deferred |
| Single AI provider (Anthropic) | Vendor dependency | Acceptable for current scale; abstraction layer planned |

---

*This policy was last updated on February 26, 2026. For questions about security, contact [abdullaalhussein@gmail.com](mailto:abdullaalhussein@gmail.com).*
