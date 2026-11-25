'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  clearAccessToken,
  getAccessToken,
  getStoredUserRaw,
  setAccessToken,
  setStoredUserRaw,
} from '@/lib/api-client';
import { authService } from '@/services/auth.service';
import type { AuthUser } from '@/types/api.types';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
  updateLocalUser: (next: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => {
    const cached = getStoredUserRaw();
    if (!cached || !getAccessToken()) return null;
    try {
      return JSON.parse(cached) as AuthUser;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(() =>
    Boolean(getAccessToken()),
  );

  const persistUser = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) {
      setStoredUserRaw(JSON.stringify(next));
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<AuthUser | null> => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      return null;
    }
    try {
      const fresh = await authService.me();
      persistUser(fresh);
      return fresh;
    } catch {
      clearAccessToken();
      setUser(null);
      return null;
    }
  }, [persistUser]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    authService
      .me()
      .then((fresh) => {
        persistUser(fresh);
      })
      .catch(() => {
        clearAccessToken();
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [persistUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAccessToken();
      setUser(null);
      router.replace('/login');
    };
    const handleMustChange = () => {
      router.replace('/change-password');
    };

    window.addEventListener('lms:unauthorized', handleUnauthorized);
    window.addEventListener('lms:must-change-password', handleMustChange);
    return () => {
      window.removeEventListener('lms:unauthorized', handleUnauthorized);
      window.removeEventListener('lms:must-change-password', handleMustChange);
    };
  }, [router]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthUser> => {
      const res = await authService.login(email, password);
      setAccessToken(res.accessToken);
      persistUser(res.user);
      return res.user;
    },
    [persistUser],
  );

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await authService.logout();
      }
    } catch {
      // ignore logout error if token already expired
    } finally {
      clearAccessToken();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshProfile,
      updateLocalUser: persistUser,
    }),
    [user, isLoading, login, logout, refreshProfile, persistUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
