import { apiGet, apiPost } from '@/lib/api-client';
import type {
  CompleteLessonResponse,
  MyProgressResponse,
} from '@/types/api.types';

export const progressService = {
  getMyProgress(): Promise<MyProgressResponse> {
    return apiGet<MyProgressResponse>('/progress/my-progress');
  },

  completeLesson(lessonId: string): Promise<CompleteLessonResponse> {
    return apiPost<CompleteLessonResponse>('/progress/update', {
      lessonId,
      isCompleted: true,
    });
  },
};
