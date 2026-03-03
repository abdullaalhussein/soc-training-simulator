import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// vi.hoisted runs before vi.mock hoisting — safe for mock references
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue({}),
  },
  refreshToken: {
    create: vi.fn().mockResolvedValue({ id: 'rt-1', tokenHash: 'h', userId: 'u', expiresAt: new Date(), createdAt: new Date() }),
    findFirst: vi.fn().mockResolvedValue(null),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  rateLimitEntry: {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({ key: 'k', endpoint: 'e', count: 1, expiresAt: new Date() }),
    delete: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  userLoginHistory: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  auditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
  scenario: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn().mockResolvedValue([]),
  },
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
}));

vi.mock('../lib/prisma', () => ({ default: mockPrisma }));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock AI service
vi.mock('../services/ai.service', () => ({
  AIService: {
    gradeShortAnswer: vi.fn().mockResolvedValue(null),
    gradeIncidentReport: vi.fn().mockResolvedValue(null),
    gradeYaraRule: vi.fn().mockResolvedValue(null),
    getCheckpointFeedback: vi.fn().mockResolvedValue(null),
    scoreInjectionRisk: vi.fn().mockResolvedValue(null),
    isAvailable: vi.fn().mockReturnValue(false),
  },
}));

// Mock scanScenarioContent (used in scenario import)
vi.mock('../utils/scanScenarioContent', () => ({
  scanScenarioContent: vi.fn().mockReturnValue({ safe: true, flaggedFields: [] }),
}));

import { app } from '../app';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/auth.service';

// Helper: generate a valid access token for a test user
function makeToken(overrides: Record<string, unknown> = {}) {
  return AuthService.generateToken({
    userId: 'user-1',
    email: 'test@soc.local',
    role: 'TRAINEE',
    tokenVersion: 0,
    ...overrides,
  });
}

function makeCsrf() {
  return 'test-csrf-token-123';
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'test@soc.local',
    password: '', // set per test
    name: 'Test User',
    role: 'TRAINEE',
    isActive: true,
    tokenVersion: 0,
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Auth: Login ──────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore defaults after each test
    mockPrisma.rateLimitEntry.findUnique.mockResolvedValue(null);
    mockPrisma.rateLimitEntry.upsert.mockResolvedValue({ key: 'k', endpoint: 'e', count: 1, expiresAt: new Date() });
    mockPrisma.rateLimitEntry.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1', tokenHash: 'h', userId: 'u', expiresAt: new Date(), createdAt: new Date() });
    mockPrisma.userLoginHistory.create.mockResolvedValue({});
    mockPrisma.userLoginHistory.count.mockResolvedValue(0);
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue(null);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'test' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@soc.local' });

    expect(res.status).toBe(400);
  });

  it('returns 401 for non-existent user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@soc.local', password: 'Password123!' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    const hashedPw = await bcrypt.hash('CorrectPassword1!', 4);
    mockPrisma.user.findUnique.mockResolvedValue(makeUser({ password: hashedPw }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@soc.local', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
  });

  it('returns 200 and sets cookies for valid credentials', async () => {
    const hashedPw = await bcrypt.hash('Password123!', 4);
    mockPrisma.user.findUnique.mockResolvedValue(makeUser({ password: hashedPw }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@soc.local', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('test@soc.local');
    expect(res.body.csrfToken).toBeDefined();

    // Verify auth cookies are set
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join('; ') : cookies;
    expect(cookieStr).toContain('accessToken');
    expect(cookieStr).toContain('refreshToken');
    expect(cookieStr).toContain('csrf');
  });

  it('returns 403 for deactivated user', async () => {
    const hashedPw = await bcrypt.hash('Password123!', 4);
    mockPrisma.user.findUnique.mockResolvedValue(makeUser({ password: hashedPw, isActive: false }));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@soc.local', password: 'Password123!' });

    expect(res.status).toBe(403);
  });
});

// ─── Auth: Me ─────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 without access token cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'accessToken=invalid-jwt-token');

    expect(res.status).toBe(401);
  });

  it('returns 200 with valid token', async () => {
    const token = makeToken();
    mockPrisma.user.findUnique.mockResolvedValue(makeUser());

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@soc.local');
  });
});

// ─── CSRF Protection ──────────────────────────────────────────

describe('CSRF protection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks POST with cookie auth but no CSRF token', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.message).toContain('CSRF');
  });

  it('blocks POST when CSRF header does not match cookie', async () => {
    const token = makeToken();
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `accessToken=${token}; csrf=cookie-value`)
      .set('X-CSRF-Token', 'different-value');

    expect(res.status).toBe(403);
  });

  it('allows POST when CSRF header matches cookie', async () => {
    const token = makeToken();
    const csrf = makeCsrf();
    mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', `accessToken=${token}; csrf=${csrf}`)
      .set('X-CSRF-Token', csrf);

    expect(res.status).not.toBe(403);
  });

  it('skips CSRF for login endpoint', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.rateLimitEntry.findUnique.mockResolvedValue(null);
    mockPrisma.rateLimitEntry.upsert.mockResolvedValue({ key: 'k', endpoint: 'e', count: 1, expiresAt: new Date() });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@soc.local', password: 'Password123!' });

    // Should be 401 (bad creds), not 403 (CSRF)
    expect(res.status).toBe(401);
  });
});

// ─── RBAC Enforcement ────────────────────────────────────────

describe('RBAC enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks TRAINEE from accessing admin user list', async () => {
    const token = makeToken({ role: 'TRAINEE' });

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(403);
  });

  it('allows ADMIN to access user list', async () => {
    const token = makeToken({ role: 'ADMIN', email: 'admin@soc.local' });
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/users')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(200);
  });

  it('blocks TRAINEE from scenario creation', async () => {
    const token = makeToken({ role: 'TRAINEE' });
    const csrf = makeCsrf();

    const res = await request(app)
      .post('/api/scenarios')
      .set('Cookie', `accessToken=${token}; csrf=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({ name: 'Test' });

    expect(res.status).toBe(403);
  });

  it('allows TRAINER to access scenarios', async () => {
    const token = makeToken({ role: 'TRAINER', email: 'trainer@soc.local' });
    mockPrisma.scenario.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/scenarios')
      .set('Cookie', `accessToken=${token}`);

    expect(res.status).toBe(200);
  });
});

// ─── Health Check ─────────────────────────────────────────────

describe('GET /api/health', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok status with DB, uptime, and memory', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('ok');
    expect(res.body.uptime).toBeTypeOf('number');
    expect(res.body.memory.rss).toBeTypeOf('number');
    expect(res.body.memory.heap).toBeTypeOf('number');
    expect(res.body.timestamp).toBeDefined();
  });

  it('returns degraded when DB is unreachable', async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database).toBe('unreachable');
  });
});

// ─── Scenario Import ─────────────────────────────────────────

describe('POST /api/scenarios/import', () => {
  const csrf = makeCsrf();

  function trainerHeaders() {
    const token = makeToken({ role: 'TRAINER', email: 'trainer@soc.local' });
    return {
      Cookie: `accessToken=${token}; csrf=${csrf}`,
      'X-CSRF-Token': csrf,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it('returns 500 for empty body (ZodError not wrapped)', async () => {
    const res = await request(app)
      .post('/api/scenarios/import')
      .set(trainerHeaders())
      .send({});

    // Scenario route passes ZodError to next() → errorHandler renders as 500
    expect(res.status).toBe(500);
  });

  it('rejects import with invalid difficulty', async () => {
    const res = await request(app)
      .post('/api/scenarios/import')
      .set(trainerHeaders())
      .send({
        name: 'Test',
        description: 'A test scenario',
        difficulty: 'IMPOSSIBLE',
        category: 'Test',
        mitreAttackIds: [],
        briefing: 'Test briefing',
      });

    expect(res.status).toBe(500); // ZodError → 500
  });

  it('accepts valid minimal scenario import', async () => {
    mockPrisma.scenario.create.mockResolvedValue({
      id: 'sc-1',
      name: 'Test Phishing',
      description: 'A phishing scenario',
      difficulty: 'BEGINNER',
      category: 'Phishing',
      mitreAttackIds: ['T1566'],
      briefing: 'Investigate a phishing email.',
      lessonContent: null,
      estimatedMinutes: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      stages: [],
      checkpoints: [],
    });

    const res = await request(app)
      .post('/api/scenarios/import')
      .set(trainerHeaders())
      .send({
        name: 'Test Phishing',
        description: 'A phishing scenario',
        difficulty: 'BEGINNER',
        category: 'Phishing',
        mitreAttackIds: ['T1566'],
        briefing: 'Investigate a phishing email.',
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Phishing');
  });

  it('blocks TRAINEE from importing', async () => {
    const token = makeToken({ role: 'TRAINEE' });
    const res = await request(app)
      .post('/api/scenarios/import')
      .set('Cookie', `accessToken=${token}; csrf=${csrf}`)
      .set('X-CSRF-Token', csrf)
      .send({
        name: 'Test',
        description: 'Test',
        difficulty: 'BEGINNER',
        category: 'Test',
        mitreAttackIds: [],
        briefing: 'Test',
      });

    expect(res.status).toBe(403);
  });
});
