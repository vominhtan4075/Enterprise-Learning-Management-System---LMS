import { apiGet, apiPatch, apiPost } from '@/lib/api-client';
import type {
  NotificationItem,
  NotificationListResponse,
  RunRemindersResponse,
} from '@/types/api.types';

export const notificationsService = {
  getAll(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<NotificationListResponse> {
    return apiGet<NotificationListResponse>('/notifications', params);
  },

  markRead(id: string): Promise<NotificationItem> {
    return apiPatch<NotificationItem>(`/notifications/${id}/read`);
  },

  markAllRead(): Promise<{ updatedCount: number; readAt: string }> {
    return apiPatch('/notifications/read-all');
  },

  runReminders(): Promise<RunRemindersResponse> {
    return apiPost<RunRemindersResponse>('/notifications/reminders/run');
  },
};
