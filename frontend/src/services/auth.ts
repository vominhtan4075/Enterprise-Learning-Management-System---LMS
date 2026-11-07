
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

export function logout() {
  if (typeof window !== 'undefined') {
    clearAuthSession();
    window.location.replace('/login');
  }
}
