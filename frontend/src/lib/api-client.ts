import type { BackendErrorPayload } from '@/types/api.types';

const TOKEN_STORAGE_KEY = 'novatech_lms_access_token';
const USER_STORAGE_KEY = 'novatech_lms_user';

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1'
).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly details?: unknown;

  constructor(
    message: string,
    status: number,
    errorCode = 'UNKNOWN_ERROR',
    details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredUserRaw(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(USER_STORAGE_KEY);
}

export function setStoredUserRaw(json: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_STORAGE_KEY, json);
}

type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

function buildUrl(endpoint: string, params?: QueryParams): string {
  const cleanEndpoint = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (!params) return cleanEndpoint;

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `${cleanEndpoint}?${qs}` : cleanEndpoint;
}

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let payload: Partial<BackendErrorPayload> | null = null;
  try {
    payload = (await res.json()) as Partial<BackendErrorPayload>;
  } catch {
    payload = null;
  }

  const rawMessage = payload?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join('; ')
    : typeof rawMessage === 'string' && rawMessage.trim()
      ? rawMessage
      : `Yêu cầu thất bại với mã trạng thái ${res.status}.`;

  const errorCode = payload?.errorCode || `HTTP_${res.status}`;
  return new ApiError(message, res.status, errorCode, payload?.details);
}

function broadcastAuthException(err: ApiError, endpoint: string): void {
  if (typeof window === 'undefined') return;
  const isLoginEndpoint = endpoint.includes('/auth/login');
  const isChangePasswordEndpoint = endpoint.includes('/auth/change-password');

  if (err.status === 401 && !isLoginEndpoint && !isChangePasswordEndpoint) {
    window.dispatchEvent(new CustomEvent('lms:unauthorized'));
  } else if (
    err.status === 403 &&
    err.errorCode === 'AUTH_MUST_CHANGE_PASSWORD'
  ) {
    window.dispatchEvent(new CustomEvent('lms:must-change-password'));
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: QueryParams;
  body?: unknown;
  isFormData?: boolean;
  skipAuth?: boolean;
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    params,
    body,
    isFormData = false,
    skipAuth = false,
  } = options;

  const headers: Record<string, string> = {};
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let fetchBody: BodyInit | undefined;
  if (body !== undefined) {
    if (isFormData && body instanceof FormData) {
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(endpoint, params), {
      method,
      headers,
      body: fetchBody,
    });
  } catch {
    throw new ApiError(
      'Không thể kết nối tới máy chủ Backend. Vui lòng kiểm tra kết nối mạng hoặc dịch vụ API.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    broadcastAuthException(err, endpoint);
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function apiGet<T>(endpoint: string, params?: QueryParams): Promise<T> {
  return request<T>(endpoint, { method: 'GET', params });
}

export function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, { method: 'POST', body });
}

export function apiPut<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, { method: 'PUT', body });
}

export function apiPatch<T>(endpoint: string, body?: unknown): Promise<T> {
  return request<T>(endpoint, { method: 'PATCH', body });
}

export function apiDelete<T>(endpoint: string): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' });
}

export function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  return request<T>(endpoint, { method, body: formData, isFormData: true });
}

export async function apiBlob(
  endpoint: string,
  params?: QueryParams,
): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(endpoint, params), {
      method: 'GET',
      headers,
    });
  } catch {
    throw new ApiError(
      'Không thể tải tệp từ máy chủ Backend.',
      0,
      'NETWORK_ERROR',
    );
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    broadcastAuthException(err, endpoint);
    throw err;
  }

  return res.blob();
}
