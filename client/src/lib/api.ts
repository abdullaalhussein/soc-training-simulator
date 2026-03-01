import axios from 'axios';

// In production, use relative URLs (Next.js rewrites proxy to the server)
// In development, use the explicit API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// H-1: CSRF token storage with localStorage persistence.
// Cross-origin deployments (e.g., Railway) set the csrf cookie on the server's domain,
// which document.cookie can't read from the client's domain. The server returns the
// CSRF token in the login/refresh response body, and we persist it in localStorage
// so it survives page refreshes.
const CSRF_STORAGE_KEY = 'csrf_token';

let _csrfToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(CSRF_STORAGE_KEY) : null;

export function setCsrfToken(token: string) {
  _csrfToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(CSRF_STORAGE_KEY, token);
  }
}

export function getCsrfToken(): string | null {
  return _csrfToken;
}

export function clearCsrfToken() {
  _csrfToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CSRF_STORAGE_KEY);
  }
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Raw axios instance for refresh calls to avoid interceptor loops
const rawAxios = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // C-1: Access token is sent as httpOnly cookie automatically (withCredentials: true).
    // H-1: Send CSRF token from in-memory storage as custom header (double-submit pattern)
    if (_csrfToken) {
      config.headers['X-CSRF-Token'] = _csrfToken;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (typeof window !== 'undefined') {
        try {
          // Cookie is sent automatically via withCredentials
          const { data } = await rawAxios.post('/auth/refresh', {});

          // Store new CSRF token from refresh response
          if (data.csrfToken) {
            setCsrfToken(data.csrfToken);
          }

          // Server has set new httpOnly cookies — retry the original request
          return api(originalRequest);
        } catch {
          // Refresh failed — logout and redirect
          const { useAuthStore } = await import('@/store/authStore');
          useAuthStore.getState().logout();
          clearCsrfToken();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
    }

    return Promise.reject(error);
  }
);
