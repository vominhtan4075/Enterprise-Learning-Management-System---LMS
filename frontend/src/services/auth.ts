
import { useSyncExternalStore } from 'react';
import type { UserProfile, UserRole } from '@/types';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const STORAGE_KEYS = {
  TOKEN: 'lms_token',
  USER: 'lms_user',
};

export type LoginResult = {
  success: boolean;
  message: string;
  accessToken?: string;
  user?: UserProfile;
};

function normalizeRole(role?: string): UserRole {
  const normalized = String(role || 'employee').trim().toLowerCase();

  if (
    normalized === 'admin' ||
    normalized === 'manager' ||
    normalized === 'employee'
  ) {
    return normalized as UserRole;
  }

  if (normalized === 'hr' || normalized === 'trainer') {
    return 'manager';
  }

  return 'employee';
}

export function saveAuthSession(session: {
  accessToken?: string;
  user?: LoginResult['user'];
}) {
  if (typeof window === 'undefined' || !session.user) return null;

  const token = session.accessToken || 'mock-jwt-token';

  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(
    STORAGE_KEYS.USER,
    JSON.stringify({
      ...session.user,
      role: normalizeRole(session.user.role),
    })
  );

  return session.user;
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;

  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

function subscribeAuth(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getClientUserSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.USER);
}

function getServerUserSnapshot(): string | null {
  return null;
}

export function useCurrentUser(): UserProfile | null {
  const raw = useSyncExternalStore(subscribeAuth, getClientUserSnapshot, getServerUserSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch {
    return null;
  }
}

export function getCurrentUser() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    const parsed = raw ? (JSON.parse(raw) as UserProfile) : null;

    return parsed
      ? { ...parsed, role: normalizeRole(parsed.role) }
      : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
}

export function updateCurrentUser(nextUser: Partial<UserProfile>) {
  if (typeof window === 'undefined') return null;

  const current = getCurrentUser();
  if (!current) return null;

  const mergedUser: UserProfile = {
    ...current,
    ...nextUser,
    role: normalizeRole(nextUser.role ?? current.role),
  };

  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mergedUser));
  return mergedUser;
}

export function hasRole(
  requiredRoles: UserRole | Array<UserRole | string>
) {
  const current = getCurrentUser();

  if (!current) return false;

  const roles = Array.isArray(requiredRoles)
    ? requiredRoles
    : [requiredRoles];

  const userRole = normalizeRole(current.role);

  return roles.some(
    (role) => normalizeRole(String(role)) === userRole
  );
}

export function canAccessPage(
  requiredRoles: UserRole | Array<UserRole | string>
) {
  return hasRole(requiredRoles);
}

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  if (!email || !password) {
    return {
      success: false,
      message: 'Vui lòng nhập email và mật khẩu.',
    };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      const payload = data?.data ?? data;
      const user = payload?.user ?? payload?.userProfile ?? null;

      if (user) {
        const result: LoginResult = {
          success: true,
          message: 'Đăng nhập thành công',
          accessToken:
            payload?.accessToken ||
            payload?.token ||
            'mock-jwt-token',
          user: {
            id: user.id || 'USR-1001',
            name: user.name || user.fullName || 'Nguyễn Văn An',
            email: user.email || email,
            role: normalizeRole(user.role || 'employee'),
            department: user.department || 'Phòng Nhân sự',
            avatar: user.avatar,
            mustChangePassword: Boolean(user.mustChangePassword),
            isActive: user.isActive ?? true,
          },
        };

        saveAuthSession(result);
        return result;
      }
    }
  } catch {
    // fallback to mock mode until NestJS auth is ready
  }

  return loginMock(email, password);
}

export async function loginMock(
  email: string,
  password: string
): Promise<LoginResult> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (!email || !password) {
    return {
      success: false,
      message: 'Vui lòng nhập email và mật khẩu.',
    };
  }

  if (email.includes('@') && password.length >= 6) {
    const user: UserProfile = {
      id: 'USR-1001',
      name: 'Nguyễn Văn An',
      email,
      role: 'employee',
      department: 'Phòng Nhân sự',
      avatar:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
      mustChangePassword: false,
      isActive: true,
    };

    const result: LoginResult = {
      success: true,
      message: 'Đăng nhập thành công',
      accessToken: 'mock-jwt-token',
      user,
    };

    saveAuthSession(result);
    return result;
  }

  return {
    success: false,
    message: 'Email hoặc mật khẩu không hợp lệ.',
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const token = getAccessToken();
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        message: data.message || 'Đổi mật khẩu thất bại.',
      };
    }

    updateCurrentUser({ mustChangePassword: false });
    return {
      success: true,
      message: data.message || 'Đổi mật khẩu thành công.',
    };
  } catch {
    updateCurrentUser({ mustChangePassword: false });
    return {
      success: true,
      message: 'Đổi mật khẩu thành công (chế độ mô phỏng).',
    };
  }
}

export async function logout() {
  if (typeof window !== 'undefined') {
    const token = getAccessToken();
    if (token) {
      try {
        await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // ignore network error on logout
      }
    }
    clearAuthSession();
    window.location.replace('/login');
  }
}
