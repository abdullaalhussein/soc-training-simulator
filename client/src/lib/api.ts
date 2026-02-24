import axios from 'axios';

// In production, use relative URLs (Next.js rewrites proxy to the server)
// In development, use the explicit API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
          const { token: newToken } = data;

          // Update the store with the new access token
          const { useAuthStore } = await import('@/store/authStore');
          const store = useAuthStore.getState();
          store.login(store.user!, newToken);

          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
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
