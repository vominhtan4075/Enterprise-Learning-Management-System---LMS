import { apiGet, apiPost } from '@/lib/api-client';
import type {
  HrmMockEmployee,
  HrmMockEmployeesResponse,
  HrmSyncLogItem,
  HrmSyncResponse,
  HrmSyncStatus,
  HrmSyncUserPayload,
  HrmTrainingStatusItem,
  PaginatedResponse,
} from '@/types/api.types';

export const hrmService = {
  async getMockEmployees(params?: {
    department?: string;
    status?: 'ACTIVE' | 'RESIGNED' | '';
  }): Promise<HrmMockEmployee[]> {
    const res = await apiGet<HrmMockEmployeesResponse>(
      '/hrm/employees',
      params,
    );
    return res.mockEmployees ?? res.data?.mockEmployees ?? [];
  },

  syncUsers(payload: HrmSyncUserPayload): Promise<HrmSyncResponse> {
    return apiPost<HrmSyncResponse>('/hrm/sync-users', payload);
  },

  getSyncLogs(params?: {
    page?: number;
    limit?: number;
    status?: HrmSyncStatus | '';
    search?: string;
  }): Promise<PaginatedResponse<HrmSyncLogItem>> {
    return apiGet<PaginatedResponse<HrmSyncLogItem>>('/hrm/sync-logs', params);
  },

  getSyncLogDetail(id: string): Promise<HrmSyncLogItem> {
    return apiGet<HrmSyncLogItem>(`/hrm/sync-logs/${id}`);
  },

  getTrainingStatus(params?: {
    page?: number;
    limit?: number;
    employeeCode?: string;
    email?: string;
    department?: string;
  }): Promise<PaginatedResponse<HrmTrainingStatusItem>> {
    return apiGet<PaginatedResponse<HrmTrainingStatusItem>>(
      '/hrm/training-status',
      params,
    );
  },
};
