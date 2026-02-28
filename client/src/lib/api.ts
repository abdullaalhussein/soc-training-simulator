import axios from 'axios';

// In production, use relative URLs (Next.js rewrites proxy to the server)
// In development, use the explicit API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/** Read a cookie by name from document.cookie */
function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
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
    // H-1: Send CSRF token from cookie as custom header (double-submit pattern)
    const csrfToken = getCookie('csrf');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
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
          await rawAxios.post('/auth/refresh', {});

          // Server has set new httpOnly cookies — retry the original request
          return api(originalRequest);
        } catch {
          // Refresh failed — logout and redirect
          const { useAuthStore } = await import('@/store/authStore');
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(error);
        }
      }
    }

    return Promise.reject(error);
  }
);
