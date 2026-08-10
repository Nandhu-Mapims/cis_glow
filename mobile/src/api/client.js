import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Mirrors client/src/api/client.js (web) but swaps localStorage for
// expo-secure-store (Keychain on iOS, Keystore on Android).
export const TOKEN_KEY = 'cis_token';

let unauthorizedHandler = null;

/** Called once from AuthContext so the interceptor can clear app state on 401. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:2003/api',
  timeout: 30000,
  headers: { Accept: 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isLoginCall = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginCall) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (unauthorizedHandler) unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export default api;
