import axios from "axios";
import { store } from "../store";
import { setAccessToken, logout } from "../store/slices/authSlice";

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ?? "") + "/api",
  withCredentials: true,
});

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try to refresh once, then retry the original request.
let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      try {
        refreshing =
          refreshing ??
          api
            .post("/auth/refresh")
            .then((r) => {
              const token = r.data.accessToken as string;
              store.dispatch(setAccessToken(token));
              return token;
            })
            .catch(() => {
              store.dispatch(logout());
              return null;
            })
            .finally(() => {
              refreshing = null;
            });
        const token = await refreshing;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        store.dispatch(logout());
      }
    }
    return Promise.reject(error);
  },
);
