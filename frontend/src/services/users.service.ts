import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '@/lib/api-client';
import type {
  CreateUserPayload,
  PaginatedResponse,
  QueryUsersParams,
  RoleCode,
  UpdateUserPayload,
  UserSummary,
} from '@/types/api.types';

export const usersService = {
  async getAll(
    params: QueryUsersParams = {},
  ): Promise<PaginatedResponse<UserSummary>> {
    const query = {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search,
      role: params.role,
      position: params.position,
      department: params.department,
      isActive: params.isActive,
    };
    const res = await apiGet<PaginatedResponse<UserSummary> | UserSummary[]>(
      '/users',
      query,
    );
    if (Array.isArray(res)) {
      return {
        data: res,
        total: res.length,
        page: 1,
        limit: res.length || 20,
        totalPages: 1,
      };
    }
    return res;
  },

  getById(id: string): Promise<UserSummary> {
    return apiGet<UserSummary>(`/users/${id}`);
  },

  create(payload: CreateUserPayload): Promise<UserSummary> {
    return apiPost<UserSummary>('/users', payload);
  },

  update(id: string, payload: UpdateUserPayload): Promise<UserSummary> {
    return apiPut<UserSummary>(`/users/${id}`, payload);
  },

  updateRole(id: string, role: RoleCode): Promise<UserSummary> {
    return apiPatch<UserSummary>(`/users/${id}/role`, { role });
  },

  updateStatus(id: string, isActive: boolean): Promise<UserSummary> {
    return apiPatch<UserSummary>(`/users/${id}/status`, { isActive });
  },

  remove(id: string): Promise<UserSummary> {
    return apiDelete<UserSummary>(`/users/${id}`);
  },
};
