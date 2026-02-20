import { FullConfig } from '@playwright/test';
import { USERS, API_URL, BASE_URL } from './test-data';
import fs from 'fs';
import path from 'path';

async function fetchWithRetry(url: string, options: RequestInit, retries = 5): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const wait = Math.min(30_000, 5_000 * (i + 1));
      console.log(`Rate limited, waiting ${wait / 1000}s before retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

async function globalSetup(_config: FullConfig) {
  const authDir = path.resolve('e2e/.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const roles = ['admin', 'trainer', 'trainee'] as const;

  // Extract the origin from BASE_URL for the storageState
  const origin = new URL(BASE_URL).origin;

  for (const role of roles) {
    const user = USERS[role];

    const response = await fetchWithRetry(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, password: user.password }),
    });

    if (!response.ok) {
      throw new Error(`Failed to login as ${role}: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();

    const authStorageValue = JSON.stringify({
      state: {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
      },
      version: 0,
    });

    // Write storageState JSON file directly (no browser needed)
    const storageState = {
      cookies: [],
      origins: [
        {
          origin,
          localStorage: [
            { name: 'token', value: data.token },
            { name: 'auth-storage', value: authStorageValue },
          ],
        },
      ],
    };

    fs.writeFileSync(
      path.resolve(authDir, `${role}.json`),
      JSON.stringify(storageState, null, 2),
    );

    console.log(`Auth state saved for ${role}`);
  }
}

export default globalSetup;
