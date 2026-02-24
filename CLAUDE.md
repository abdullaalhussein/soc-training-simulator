# CLAUDE.md

## Project Overview

SOC Training Simulator — an open-source multi-role platform that prepares SOC analysts for real incidents before they face one. Built with Next.js 15, Express 5, PostgreSQL, Socket.io, and Anthropic Claude AI.

## Key Commands

```bash
npm run dev                  # Run client + server concurrently
npm run build                # Build shared → server → client
npm run db:push              # Push Prisma schema to database
npm run db:seed              # Seed demo users & all 13 scenarios
cd server && npm test        # Run unit tests (Vitest, 40 tests)
npm run test:e2e             # Run Playwright E2E tests (66 tests)
```

## Architecture

- **Monorepo** with npm workspaces: `client/`, `server/`, `shared/`, `prisma/`
- **Client:** Next.js 15, React 19, Zustand, TanStack Query, Tailwind CSS, Radix UI
- **Server:** Express 5, Socket.io, JWT auth (httpOnly cookies for refresh tokens), Prisma ORM, Zod
- **Database:** PostgreSQL 16, Prisma schema at `prisma/schema.prisma` (13 models, 7 enums)
- **AI:** Anthropic Claude API (SOC Mentor, AI Scoring, Scenario Generator) — optional BYOK
- **Testing:** Vitest (unit), Playwright (E2E)

## Code Conventions

- TypeScript strict mode everywhere
- Server uses CommonJS (`module: "commonjs"` in tsconfig)
- Zod for request validation on all API routes
- RBAC: ADMIN, TRAINER, TRAINEE roles enforced via middleware
- Socket.io namespaces: `/trainer` and `/trainee` with per-socket auth + rate limiting
- AI output filter at `server/src/utils/filterAiResponse.ts` — 4-layer filter prevents answer leaks

## Security Notes

- Refresh tokens stored in httpOnly cookies (not localStorage)
- JWT access token expiry: 4h (configurable via JWT_EXPIRES_IN)
- AI daily rate limit per user (default 30, configurable via AI_DAILY_LIMIT)
- Default demo credentials: admin/trainer/trainee@soc.local / Password123! — server warns on startup

---

# Virtual Advisory Board — Full Record

**Date:** February 23-24, 2026
**Chairman:** Abdullah Al-Hussein (Project Owner) — Final decision authority. No agent overrides the Chairman.

---

## Board Members

| Seat | Role | Personality | Focus |
|------|------|-------------|-------|
| 1 | **Strategic Advisor** | Big-picture thinker, long-term vision, risk-aware | Sustainability, scalability, positioning, moat, competitive defense. Challenges short-term thinking. |
| 2 | **Market Analyst** | Data-driven, skeptical | TAM/SAM/SOM, competitor landscape, demand validation, trends. Rejects assumptions without evidence. |
| 3 | **Technical & Cybersecurity Director** | Systems thinker, security-first, architecture-focused | Scalability, integrations, data protection, technical debt, risk surface. Rejects ideas that break architecture or security logic. |
| 4 | **Sales Advisor** | Practical, revenue-oriented | Conversion, pricing psychology, sales cycle, customer objections. Pushes for clarity in value proposition. |
| 5 | **Financial Director** | Conservative, ROI-focused | Cash flow, burn rate, capital allocation, margin, payback period. Challenges emotional or risky spending. |
| 6 | **Legal Advisor** | Risk-minimizer, regulation-aware | Compliance, contracts, liability, IP protection, regional laws. Blocks anything legally exposed. |
| 7 | **Marketing Expert** | Creative but structured | Brand positioning, audience targeting, messaging clarity. Rejects vague branding. |
| 8 | **Relationship Advisor** | Diplomatic strategist | Partnerships, stakeholders, reputation impact. Evaluates long-term network implications. |
| 9 | **Innovation Advisor** | Visionary, challenges comfort zone | Differentiation, disruption, future tech, AI leverage. Pushes beyond safe thinking. |
| 10 | **UX/UI Design Director** | User-obsessed, clarity-driven, accessibility-focused | User flows, information hierarchy, visual clarity, mobile responsiveness, cognitive load reduction. |
| 11 | **Project Manager** | Execution-focused, deadline-driven, dependency-aware | Scope control, delivery timelines, resource allocation, task prioritization, risk to delivery. |

---

## Agenda Item #1: AI Assistant Feature Review

**Question:** "Review the AI Assistant feature. Should we keep it, remove it, or redesign it? What are the risks and opportunities?"

### Individual Statements

**Strategic Advisor:**
> "The AI Assistant is not merely a feature; it is the strategic differentiator that separates this platform from static quiz-based SOC training tools. Removing it would be a regressive decision that surrenders the most defensible competitive moat this project has. However, the Chairman's concern is valid and must be addressed architecturally, not by elimination. The correct strategic move is to harden and evolve the assistant into a tiered mentoring system where trainers control the level of AI guidance per session, per difficulty level, and per trainee. Long-term, the conversation logs stored in the `AiAssistantMessage` table represent a gold mine for understanding trainee learning patterns, which can feed into adaptive difficulty systems. I recommend keeping the feature, investing in hardening, and positioning the AI assistant as the headline capability in go-to-market messaging."

**Market Analyst:**
> "Let me be direct: the SOC training market is moving toward AI-augmented learning. CyberDefenders, LetsDefend, and TryHackMe are all integrating AI assistants. Removing this feature does not just leave money on the table; it makes the platform appear dated to procurement committees who are actively seeking AI-enabled solutions. That said, I need to flag a gap: we have no data on how trainees are actually using the assistant today. Without this data, the Chairman's concern is anecdotal rather than evidence-based. Before making any decision, instrument the feature with usage analytics. How many of the 20 allowed messages per attempt do trainees actually use? What percentage of messages are adversarial? These numbers should drive the decision, not speculation."

**Technical & Cybersecurity Director** (identified 4 concrete risks):
> "**First**, the scenario briefing, stage title, and stage description are injected verbatim into the system prompt. A malicious trainer could craft scenario content that serves as a prompt injection vector, causing the AI to leak information. This is an indirect injection risk."
> "**Second**, the conversation history is sent in full (up to 50 messages) without any server-side content sanitization."
> "**Third**, there is no output filtering. The AI response is returned directly to the client without any post-processing check for whether it inadvertently contains answer-like content."
> "**Fourth**, the `max_tokens: 500` limit is appropriate for keeping responses concise but does not prevent a single response from containing a complete answer if the model's guardrails are bypassed."
> Recommendation: "Keep the feature, add server-side output filtering, sanitize scenario content before injection into the system prompt, and implement an audit log that flags suspicious conversation patterns for trainer review."

**Sales Advisor:**
> "The AI Assistant is the single most demonstrable feature in a live product demo. When I imagine walking a CISO or a training department head through the platform, the moment where they see a trainee getting Socratic guidance in real-time is the moment the deal advances. Without it, we are selling a sophisticated quiz engine. With it, we are selling an intelligent training platform. The 20-message cap per attempt is actually a selling point for enterprise buyers because it shows cost discipline and prevents runaway API costs in multi-seat deployments."

**Financial Director:**
> "At current Anthropic pricing, a single assistant interaction with full context could cost between $0.01 and $0.05 depending on conversation length. With 20 messages per attempt, worst-case per-attempt AI cost is approximately $1.00. At scale -- say 500 trainees running 2 attempts per week -- that is $52,000 annually in API costs alone, before grading and scenario generation costs. I recommend establishing a tiered pricing model where the AI assistant is a premium feature, not included in the base tier. This protects margin and creates an upsell path. Removing the feature eliminates a revenue opportunity. Keeping it without cost controls is financially irresponsible."

**Legal Advisor** (three concerns):
> (1) Data processing liability if government agencies send scenario data to Anthropic's API.
> (2) Negligence exposure if AI gives incorrect security guidance.
> (3) GDPR compliance for AI conversation logs in `AiAssistantMessage`.
> "I do not recommend removal, but I block any expansion of the feature until these legal guardrails are in place."

**Marketing Expert:**
> "The AI Assistant is the most marketable feature in this entire platform. It enables a narrative that no competitor in the open-source SOC training space can match: 'Learn like you have a senior SOC analyst sitting next to you.' I would position this as the 'SOC Mentor' rather than 'AI Assistant.' The word 'assistant' implies it does work for you; 'mentor' implies it develops you."

**Relationship Advisor:**
> Three stakeholder implications: Trainers may perceive AI as a threat; institutional buyers will trigger security reviews; open-source community benefits from the optional nature (disabled without API key).
> "I recommend keeping the feature, adding a trainer-facing AI conversation review panel, and creating documentation that helps institutional buyers complete their AI security assessments."

**Innovation Advisor:**
> "The AI Assistant as currently implemented is good, but it is a version 1.0 of what this should become. The real opportunity is not a chatbot that answers questions. It is an adaptive investigation system where the AI observes trainee behavior in real-time -- which logs they click, how long they spend on each stage, what evidence they collect -- and proactively intervenes when they are stuck or going down the wrong path."

### Cross-Debates

**Financial Director vs. Innovation Advisor:**
> Financial: "Proactive AI mentoring that monitors every trainee click in real-time and generates custom scenarios sounds compelling in a pitch deck. But you are proposing to multiply API costs by an order of magnitude."
> Innovation: "The behavioral monitoring does not need to trigger an API call on every action. It can batch observations and trigger AI intervention at decision points -- stage transitions, evidence collection thresholds, time-on-stage thresholds. This reduces the call frequency to perhaps 3-5 proactive interventions per attempt."

**Technical Director vs. Marketing Expert:**
> Technical: "Rebranding from 'AI Assistant' to 'SOC Mentor' creates a higher standard of care. If we call it a mentor, users will have higher expectations for the quality and accuracy of its guidance."
> Marketing: "The current Socratic implementation is already mentor-like in behavior -- it asks questions, challenges reasoning, teaches methodology. The name should match what the product actually does, not undersell it out of caution."

**Legal Advisor vs. Strategic Advisor:**
> Legal: "Making AI the centerpiece of the platform's identity increases our exposure if the feature fails, gets jailbroken publicly, or faces regulatory scrutiny."
> Strategic: "The answer is transparency, not timidity. We lead with the AI capability but we also lead with our security posture around it. 'AI-powered SOC training with enterprise-grade guardrails' is a stronger message than 'training platform with optional AI.'"

### Vote & Consensus

**Unanimous (9/9):** Do NOT remove the AI Assistant. All nine members recommended keeping.

**Unanimous:** The Chairman's concern about answer leakage is valid and must be addressed through engineering, not removal.

**Unanimous:** Usage analytics are missing and urgently needed.

**Unanimous:** Trainer visibility into AI conversations is critical.

### Recommended Direction: KEEP AND HARDEN

**Phase 1 — Immediate Hardening (Weeks 1-3):**
- Server-side output filtering scanning for checkpoint keywords and correct answer content
- Sanitize scenario content before injection into AI system prompt
- Trainer-level toggle to enable/disable AI per session
- Conversation anomaly detection for jailbreak attempts
- Legal disclaimers and AI data processing disclosure

**Phase 2 — Instrumentation and Visibility (Weeks 3-6):**
- Usage analytics pipeline over `AiAssistantMessage` data
- Trainer-facing AI conversation review panel
- Enterprise AI security posture brief
- Data retention policy for AI conversation logs

**Phase 3 — Strategic Expansion (Months 2-4):**
- Evaluate "SOC Mentor" rebrand based on quality metrics
- Prototype behavioral-aware proactive mentoring
- Connect scenario generator to trainee performance data
- Implement premium-tier pricing

**Minority Opinion:** No board member recommended removal. Closest dissent: Financial Director conditionally supports but warns expansion beyond Phase 1 must be justified by usage data. Reserves right to recommend feature freeze if fewer than 30% of trainees actively use the assistant.

---

## Agenda Item #2: Deeper AI Assistant Assessment (11-member board)

Refinement of Item #1 with UX/UI Director and Project Manager contributing.

### Key New Contributions

**UX/UI Design Director** (3 UX problems):
> "First, the assistant is spatially disconnected from the investigation workflow. On desktop, it lives in a slide-out sheet on the right side -- the trainee must stop investigating, open the sheet, type a question, read the answer, close the sheet, and return to the logs. This context-switch penalty discourages usage."
> "Second, the message display is plain text with no markdown rendering."
> "Third, the rate limit indicator ('X left') creates cognitive overhead."

**Project Manager** (reframed timeline):
> Phase 1 (2-3 weeks): output filtering, markdown rendering, trainer toggle, privacy notice, token tracking, basic analytics, configurable message limits.
> Phase 2 (3-4 weeks): trainer review panel, behavioral context injection, structured trainer context injection.
> Phase 3 (4-6 weeks): proactive mentoring, post-scenario AI debriefs, AI-driven adaptive difficulty.

### Additional Debates

**Market Analyst vs. Sales Advisor on proactive nudging:**
> Market Analyst: "A proactive nudge every time a trainee stalls for 3 minutes may train dependency rather than resilience. Real SOC analysts must tolerate ambiguity without a prompt."
> Sales Advisor: "Make it trainer-configurable, defaulting to off in instructor-led sessions. For self-study mode, default to on."

**Legal Advisor vs. Relationship Advisor on trainer context injection:**
> Legal: "If a trainer writes biased or inappropriate instructions, the AI's behavior changes in ways the trainee cannot see. This creates an opaque influence channel."
> Relationship: "Agreed. Trainer context injection should be structured (dropdown selections), not free-text."

**Standing Objection (Market Analyst):**
> "The board is proceeding with expansion plans without validating that the AI assistant improves trainee outcomes. The minimum viable validation is a statistical comparison of attempt scores between trainees who used the AI assistant (sent at least 3 messages) versus those who did not, across a sample of at least 50 completed attempts."

---

## Agenda Item #3: Scenario Builder Simplification

**Question:** "The admin scenario builder has too many fields. The admin should just describe the scenario and AI creates everything. But some fields like MITRE ATT&CK should still be selectable (not typed). What does the board think?"

### Key Positions

**Technical Director** (pivotal proposal):
> "Implement a two-phase generation flow. Phase one: the AI parses the description and proposes the structured fields (difficulty, category, MITRE techniques, stages). Phase two: the admin reviews, adjusts if needed, then confirms to trigger full scenario generation. This preserves AI efficiency while maintaining human-in-the-loop validation -- which is non-negotiable in a cybersecurity training context."

**Sales Advisor:**
> "The pitch becomes: 'Describe the attack you want to train on, and we build the entire investigation for you -- in seconds.'"

**Legal Advisor:**
> "The human-in-the-loop review step the Technical Director proposed is not just good UX -- it is a legal safeguard."

**Innovation Advisor:**
> "If we are already having the AI infer structured fields from natural language, the next logical step is conversational scenario building. Instead of a single text box, imagine a brief back-and-forth."

**UX/UI Design Director:**
> "Primary input -- a single large text area with placeholder text showing an example description. AI suggestion panel -- after the admin types and triggers generation, the AI populates a side panel with its proposed difficulty, category, MITRE techniques, and stage count. Each of these is an editable chip, dropdown, or selector."

### Consensus (all 11 agreed)
- MITRE ATT&CK text input must be replaced with a searchable, browsable selector component
- Description should be the only required field; all other fields become optional advanced overrides
- AI infers missing fields and returns them for review
- Admin reviews/edits generated scenario before publishing

### Shipping Sequence Conflict
> **Project Manager:** "Ship certainty first, ambition second" — MITRE selector first, AI inference second.
> **Innovation Advisor:** "The phased approach risks delivering a half-measure that feels incremental."
> **Technical Director** mediated: "Ship the MITRE selector in sprint one while simultaneously developing and internally testing the AI inference pipeline. We can run the inference in shadow mode."

**Minority Opinion:** Innovation Advisor formally dissents on phasing: "The phased approach, while operationally safe, risks the platform appearing iterative rather than visionary during a critical adoption window."

---

## Agenda Item #4: Full Project Assessment — Session #1

**Question:** "What do you think about the overall project?" — comprehensive honest assessment.

### SWOT Analysis

**Strengths:**
- Comprehensive SOC analyst workflow (logs, evidence, timeline, checkpoints, reporting)
- AI at three levels (mentoring, grading, generation) with anti-jailbreak hardening
- Modern tech stack with TypeScript throughout
- 8 checkpoint types including YARA rule challenges (no competitor offers this)
- 5-category weighted scoring model
- Open-source with MIT license; E2E test suite with 66 Playwright tests
- CLA preserves commercial optionality

**Weaknesses:**
- Zero external users (no validated product-market fit)
- Single developer (bus factor of one)
- Only 8 scenarios
- No onboarding experience
- In-memory rate limiting doesn't survive restarts
- No unit tests, no AI retry logic
- No revenue model or pricing
- Landing page lacks social proof and conversion optimization
- No accessibility support

**Opportunities:**
- $20B+ market with 3.5M professional shortage
- Open-source positioning unique among competitors
- AI scenario generator can scale content exponentially
- University/bootcamp partnerships offer immediate user base
- Adaptive AI difficulty using existing investigation action data
- Scenario marketplace could create network effects

**Threats:**
- Well-funded competitors (Immersive Labs $189M, RangeForce $35M)
- MIT license allows commercial forks
- Single AI provider dependency (Anthropic)
- YARA execution is a code execution attack surface
- Solo maintainer burnout without revenue

### Key Cross-Debates

**Innovation Advisor vs. Project Manager (feature freeze):**
> Innovation: "I strongly disagree with freezing feature development. The AI adaptive difficulty and expanded challenge types are what will differentiate."
> PM: "You are proposing building features for hypothetical users. There are zero external users right now."
> Resolved: Build ONE differentiating AI feature (post-incident review) with a feedback mechanism.

**Legal Advisor vs. Strategic Advisor (licensing):**
> Legal: "The MIT license is a strategic vulnerability. I recommend relicensing to AGPL or BSL before the project gains traction."
> Strategic: "Relicensing to AGPL kills the open-source adoption story. MIT core, proprietary enterprise features, CLA for contributor code."
> Resolved: Keep MIT for now. Revisit only if a competitor fork becomes a real threat.

### Market Potential Assessment
- **Short-term (0-12 months):** Limited. Goal: 5-15 pilot organizations. Early revenue $1-5K/month if managed cloud launches.
- **Medium-term (1-3 years):** With 50+ scenarios and proven pilots, $50-250K/year.
- **Long-term (3-5 years):** If network effects built, "WordPress of SOC training." Revenue $1-5M/year.
- **Minority opinion (Innovation, Strategic):** If adaptive AI SOC training achieved first, ceiling is $10M+ ARR.

### Final Advisory
> "Stop building features for the next 6 weeks. The platform has enough capability to deliver real value today. What it lacks is users, feedback, and market validation. Send 15 cold emails to cybersecurity bootcamps this week. Offer free pilot programs."
> **"The path to value is: Validate, then Stabilize, then Scale."**

---

## Agenda Item #5: Full Project Assessment — Session #2 (Post-Implementation)

Updated assessment after Phase 1 implementation. Board acknowledged 12 deliverables shipped:
- SOC Mentor (hardened AI assistant), AI output filter, per-user daily rate limits (DB-backed), scenario generator simplification, MITRE ATT&CK picker, CI pipeline, trainee onboarding guide, stage navigation, last checkpoint auto-close fix, rich results screen, evidence/timeline redesign, trainee dashboard stats fix.

**Strategic Advisor update:**
> "The project has shifted from 'technically strong but incomplete' to 'feature-complete MVP with AI differentiation.' Still no monetization model. The clock is ticking."

**Market Analyst** updated competitive comparison showing SOC Training Simulator had feature parity or superiority to paid competitors (CyberDefenders, LetsDefend, TryHackMe) across self-hosted, open-source, AI scenario generation, AI mentor, AI scoring, YARA testing, MITRE mapping, and real-time trainer monitoring — all for free.

**Technical Director** scored Session #1 recommendations:
- WebSocket rate limiting: DONE
- DB indexing: Already existed (12 indexes)
- httpOnly cookies: NOT DONE (now done in Sprint 1)
- Unit tests: NOT DONE (now done in Sprint 1)
- JWT expiry reduction: NOT DONE (now done in Sprint 1)

**Innovation Advisor:**
> "I must acknowledge -- my Session #1 criticism was comprehensively addressed. 'No AI integration -- glaring gap' became 4 AI features shipped."

### Unanimous Recommendation: 1-Week Sprint

| Day | Action |
|-----|--------|
| Day 1 | Write unit tests for scoring service + AI output filter |
| Day 2 | Generate 2-3 seed scenarios, move refresh tokens to httpOnly cookies, reduce JWT to 4h |
| Day 3 | Add BYOK documentation, demo credential warnings |
| Day 3 | Record 2-minute demo video |
| Day 4 | Rewrite README (screenshots, video, comparison table, one-click deploy) |
| Day 5 | Post on LinkedIn, Reddit r/cybersecurity, Hacker News |

### Final Advisory
> "Your project is no longer 'promising.' It's **ready**. The only thing missing is the world knowing about it."

---

## Hardening Sprint — Implementation Record

### Completed (Feb 24, 2026)

| # | Board Recommendation | Status | Commit |
|---|---------------------|--------|--------|
| 1 | Add unit tests for scoring service + AI output filter | Done (40 tests) | 7915e0e |
| 2 | Move refresh tokens from localStorage to httpOnly cookies | Done | 7915e0e |
| 3 | Reduce JWT access token expiry from 24h to 4h | Done | 7915e0e |
| 4 | Seed all 8 JSON scenario files in db:seed (13 total) | Done | 7915e0e |
| 5 | Rewrite README with BYOK docs, comparison table, quick deploy | Done | 7915e0e |
| 6 | Extract filterAiResponse into testable module | Done | 7915e0e |
| 7 | Add unit-test job to CI pipeline | Done | 7915e0e |
| 8 | Fix CI prisma generate path + workspace root install | Done | 5f72db7 |

---

## Items Discussed But NOT Yet Implemented

These were raised by board members but explicitly deferred or deprioritized:

1. **Conversational scenario building** (Innovation Advisor) — multi-turn AI conversation for scenario creation. Deferred to Phase 3+.
2. **Relicensing to AGPL/BSL** (Legal Advisor) — rejected by majority. Strategic Advisor: "kills the open-source adoption story."
3. **Multiplayer/collaborative investigation mode** (Innovation Advisor) — deferred. Stability and adoption first.
4. **Sigma rule, KQL query, SPL exercise challenge types** (Innovation Advisor) — deferred to Phase 3. PM: "do not build three new challenge types before a single user has asked for them."
5. **Sandbox/VM integration** for actual endpoint interaction — noted but not planned.
6. **Gamification beyond scoring** — badges, leaderboards, streaks, team competitions. Deferred to Phase 3.
7. **Threat intelligence feed integration** for auto-generating scenarios from real-world incidents — deferred.
8. **API for third-party integrations** to plug into existing SOC toolchains — mentioned but not planned.
9. **Revenue within 6 months deadline** (Sales Advisor) — rejected by Strategic Advisor: "Revenue pressure this early kills positioning."
10. **Pricing page with billing infrastructure** (Sales Advisor) — compromised to "Coming Soon" page with email capture only.
11. **Free-text trainer context injection into AI** (Relationship Advisor) — blocked by Legal Advisor. Constrained to structured dropdown selections only.
12. **Proactive nudge as default behavior** (Sales Advisor) — blocked by Market Analyst (trains dependency). Compromised to trainer-configurable toggle, defaulting to off.
13. **CSRF protection** — consider adding CSRF tokens for cookie-based auth in production.
14. **Integration tests** — tests that hit actual API routes with a test database.
15. **Scenario difficulty balancing** — review point distributions across scenarios.
16. **Accessibility audit** — WCAG compliance check for the investigation workspace.
17. **Monitoring & observability** — structured logging, health check dashboards, error tracking.
18. **SSO / SAML support** — enterprise feature request for organizational deployments.
19. **Demo video** — 2-minute walkthrough for README/LinkedIn (from Sprint recommendation).
20. **Launch posts** — LinkedIn, Reddit r/cybersecurity, Hacker News (from Sprint recommendation).
