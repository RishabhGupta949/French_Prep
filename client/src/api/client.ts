
import { useAuthStore } from '../features/auth/authStore';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RefreshResult =
  | { type: 'success'; token: string }
  | { type: 'invalid' }
  | { type: 'unavailable' };

// Only one refresh request can run at a time.
let refreshPromise: Promise<RefreshResult> | null = null;

async function performRefresh(): Promise<RefreshResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (response.status === 401 || response.status === 403) {
      return { type: 'invalid' };
    }

    if (!response.ok) {
      return { type: 'unavailable' };
    }

    const data: { accessToken?: unknown } = await response.json();

    if (
      typeof data.accessToken !== 'string' ||
      !data.accessToken
    ) {
      return { type: 'invalid' };
    }

    useAuthStore.getState().setAccessToken(data.accessToken);

    return {
      type: 'success',
      token: data.accessToken,
    };
  } catch {
    return { type: 'unavailable' };
  }
}

async function refreshSession(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// Preserve the existing exported helper.
export async function refreshAccessToken(): Promise<string | null> {
  const result = await refreshSession();

  return result.type === 'success' ? result.token : null;
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

function isAuthEndpoint(endpoint: string): boolean {
  return /^\/auth\/(login|register|refresh)(?:\?|$)/.test(endpoint);
}

function redirectToLogin(): void {
  useAuthStore.getState().logout();

  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/login')
  ) {
    window.location.replace('/login');
  }
}

async function sendRequest(
  endpoint: string,
  options: RequestInit,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    headers.delete('Authorization');
  }

  return fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  let token = getAccessToken();

  let response = await sendRequest(endpoint, options, token);

  // Access token expired: attempt a silent refresh.
  if (response.status === 401 && !isAuthEndpoint(endpoint)) {
    const refreshResult = await refreshSession();

    if (refreshResult.type === 'success') {
      token = refreshResult.token;

      // Retry the original request exactly once.
      response = await sendRequest(endpoint, options, token);

      // Even the refreshed token was rejected.
      if (response.status === 401) {
        redirectToLogin();

        throw new ApiError(
          401,
          'SESSION_EXPIRED',
          'Your session has expired. Please sign in again.',
        );
      }
    } else if (refreshResult.type === 'invalid') {
      redirectToLogin();

      throw new ApiError(
        401,
        'SESSION_EXPIRED',
        'Your session has expired. Please sign in again.',
      );
    } else {
      // Network/server failure: retain the session and allow retry.
      throw new ApiError(
        503,
        'SESSION_REFRESH_UNAVAILABLE',
        'Unable to verify your session. Please try again.',
      );
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
    );
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'GET' }),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export { ApiError };
