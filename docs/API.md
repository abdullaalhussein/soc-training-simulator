# API Reference

## REST Endpoints

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
