const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1`
    : 'http://localhost:5000/api/v1');

export function getAccountLockState(user: { isActive?: boolean } | null): 'active' | 'locked' {
  if (!user) return 'active';
  return user.isActive === false ? 'locked' : 'active';
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  errorCode?: string;
  timestamp?: string;
  path?: string;
  details?: unknown[];
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('lms_token') : null;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return {} as T;
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorData = data as ApiErrorResponse | null;
    const message =
      errorData?.message ||
      `Yêu cầu thất bại với mã lỗi ${response.status} (${response.statusText})`;

    if (response.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('lms_token');
      localStorage.removeItem('lms_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (
      response.status === 403 &&
      errorData?.errorCode === 'AUTH_MUST_CHANGE_PASSWORD' &&
      typeof window !== 'undefined'
    ) {
      if (window.location.pathname !== '/change-password') {
        window.location.href = '/change-password';
      }
    }

    const error = new Error(message) as Error & {
      statusCode?: number;
      errorCode?: string;
      data?: unknown;
    };
    error.statusCode = response.status;
    error.errorCode = errorData?.errorCode;
    error.data = errorData;
    throw error;
  }

  return data as T;
}
