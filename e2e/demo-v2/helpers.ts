import { Page } from '@playwright/test';
import { API_URL, USERS } from '../fixtures/test-data';

// ---------------------------------------------------------------------------
// Network helpers
// ---------------------------------------------------------------------------

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 5
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const wait = Math.min(30_000, 5_000 * (i + 1));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

export async function loginAs(role: 'admin' | 'trainer' | 'trainee') {
  const user = USERS[role];
  const res = await fetchWithRetry(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) throw new Error(`${role} login failed: ${res.status}`);
  const data = await res.json();
  return { user: data.user, token: data.token };
}

/**
 * Inject auth into page via localStorage (runs before any navigation).
 */
export async function injectAuth(
  page: Page,
  user: any,
  token: string
) {
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('token', token);
      localStorage.setItem(
        'auth-storage',
        JSON.stringify({
          state: { user, token, isAuthenticated: true },
          version: 0,
        })
      );
    },
    { user, token }
  );
}

// ---------------------------------------------------------------------------
// Session cleanup
// ---------------------------------------------------------------------------

export async function cleanAllSessions(token: string) {
  const res = await fetch(`${API_URL}/api/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sessions = await res.json();
  for (const s of sessions) {
    if (s.status === 'ACTIVE' || s.status === 'PAUSED') {
      await fetchWithRetry(`${API_URL}/api/sessions/${s.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
    }
    await fetchWithRetry(`${API_URL}/api/sessions/${s.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

export async function getScenarios(token: string) {
  const res = await fetch(`${API_URL}/api/scenarios`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenarios = await res.json();
  if (!scenarios?.length) throw new Error('No scenarios seeded — run npm run db:seed first');
  return scenarios;
}

export async function getTrainee(token: string) {
  const res = await fetch(`${API_URL}/api/users?role=TRAINEE`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const trainees = await res.json();
  return trainees.find((t: any) => t.email === USERS.trainee.email) || trainees[0];
}

export async function createAndLaunchSession(
  token: string,
  name: string,
  scenarioId: string,
  memberIds: string[]
) {
  const sessionRes = await fetch(`${API_URL}/api/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, scenarioId, memberIds }),
  });
  const session = await sessionRes.json();

  await fetch(`${API_URL}/api/sessions/${session.id}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status: 'ACTIVE' }),
  });

  return session;
}

export async function startAttempt(token: string, sessionId: string) {
  const res = await fetch(`${API_URL}/api/attempts/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sessionId }),
  });
  return res.json();
}

export { API_URL, USERS };
