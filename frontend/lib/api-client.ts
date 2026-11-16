import type { UserProfile } from '../src/types';

export type AccountLockState = 'locked' | 'unlocked';

export interface ApiClientErrorShape {
  message?: string;
  errorCode?: string;
  statusCode?: number;
  details?: unknown[];
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const STORAGE_KEYS = {
  TOKEN: 'lms_token',
  USER: 'lms_user',
} as const;

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

export function getStoredAuthUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

export function getAccountLockState(
  user: Partial<UserProfile> | null = getStoredAuthUser(),
): AccountLockState {
  if (!user) return 'locked';
  if (user.mustChangePassword || user.isActive === false) return 'locked';
  return 'unlocked';
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly details?: unknown[];

  constructor(
    status: number,
    message: string,
    errorCode?: string,
    details?: unknown[]
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

function isErrorPayload(value: unknown): value is ApiClientErrorShape {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isErrorPayload(payload)) return fallback;
  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  return fallback;
}

function getErrorCode(payload: unknown): string | undefined {
  if (!isErrorPayload(payload)) return undefined;
  return typeof payload.errorCode === 'string' ? payload.errorCode : undefined;
}

function getErrorDetails(payload: unknown): unknown[] | undefined {
  if (!isErrorPayload(payload) || !Array.isArray(payload.details)) {
    return undefined;
  }

  return payload.details;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function apiClient<T>(
  path: string,
  init: RequestInit = {},
  options: { skipAuth?: boolean } = {}
): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers || {});

  if (!options.skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type') &&
    method !== 'GET' &&
    method !== 'HEAD'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
  });

  let payload: unknown = null;
  try {
    payload = await readJsonBody(response);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const errorMessage = getErrorMessage(
      payload,
      `Request failed with status ${response.status}`
    );
    const errorCode = getErrorCode(payload);
    const details = getErrorDetails(payload);

    if (response.status === 401) {
      clearAuthSession();
      if (typeof window !== 'undefined') {
        const nextPath = window.location.pathname;
        if (!nextPath.startsWith('/login')) {
          window.location.href = '/login?reason=session_expired';
        }
      }
    }

    if (
      response.status === 422 &&
      typeof window !== 'undefined' &&
      (errorCode === 'AUTH_FORBIDDEN' ||
        errorCode === 'AUTH_UNAUTHORIZED' ||
        /khóa|lock|must change password|đổi mật khẩu/i.test(errorMessage))
    ) {
      const nextPath = window.location.pathname;
      if (!nextPath.startsWith('/login')) {
        window.location.href = '/login?reason=account_locked';
      }
    }

    throw new ApiClientError(
      response.status,
      errorMessage,
      errorCode,
      details
    );
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}
