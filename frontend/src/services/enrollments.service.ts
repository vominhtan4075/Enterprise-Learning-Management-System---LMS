import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import type {
  AssignCourseEnrollmentPayload,
  AssignPathPayload,
  BatchAssignResponse,
  EnrollmentItem,
  EnrollmentStatus,
  PaginatedResponse,
} from '@/types/api.types';

export const enrollmentsService = {
  getAll(params?: {
    page?: number;
    limit?: number;
    type?: 'COURSE' | 'PATH' | '';
    userId?: string;
    courseId?: string;
    pathId?: string;
    department?: string;
    status?: EnrollmentStatus | '';
    overdue?: boolean | '';
  }): Promise<PaginatedResponse<EnrollmentItem>> {
    return apiGet<PaginatedResponse<EnrollmentItem>>('/enrollments', params);
  },

  getById(id: string): Promise<EnrollmentItem> {
    return apiGet<EnrollmentItem>(`/enrollments/${id}`);
  },

  assignCourse(
    payload: AssignCourseEnrollmentPayload,
  ): Promise<BatchAssignResponse> {
    return apiPost<BatchAssignResponse>('/enrollments', payload);
  },

  assignPath(payload: AssignPathPayload): Promise<BatchAssignResponse> {
    return apiPost<BatchAssignResponse>('/assignments/path', payload);
  },

  updateDeadline(id: string, deadline: string): Promise<EnrollmentItem> {
    return apiPut<EnrollmentItem>(`/enrollments/${id}`, { deadline });
  },

  remove(
    id: string,
  ): Promise<{ id: string; type: 'COURSE' | 'PATH'; deleted: boolean }> {
    return apiDelete(`/enrollments/${id}`);
  },
};
