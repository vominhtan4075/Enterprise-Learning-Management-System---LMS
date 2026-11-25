import { apiGet, apiPost, apiPut } from '@/lib/api-client';
import type {
  AuthUser,
  HealthStatusResponse,
  LoginResponse,
} from '@/types/api.types';

export const authService = {
  getHealth(): Promise<HealthStatusResponse> {
    return apiGet<HealthStatusResponse>('/health');
  },

  login(email: string, password: string): Promise<LoginResponse> {
    return apiPost<LoginResponse>('/auth/login', { email, password });
  },

  me(): Promise<AuthUser> {
    return apiGet<AuthUser>('/auth/me');
  },

  updateMe(fullName: string): Promise<AuthUser> {
    return apiPut<AuthUser>('/auth/me', { fullName });
  },

  changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string; mustChangePassword: boolean }> {
    return apiPost('/auth/change-password', { currentPassword, newPassword });
  },

  logout(): Promise<void> {
    return apiPost('/auth/logout');
  },
};
