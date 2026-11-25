import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import type {
  CreateLearningPathPayload,
  LearningPathDetail,
  LearningPathSummary,
  PathValidationResult,
  PositionLevel,
  UpdateLearningPathPayload,
} from '@/types/api.types';

export const learningPathsService = {
  getAll(params?: {
    targetPosition?: PositionLevel | '';
    isMandatory?: boolean | '';
    search?: string;
  }): Promise<LearningPathSummary[]> {
    return apiGet<LearningPathSummary[]>('/learning-paths', params);
  },

  getById(idOrCode: string): Promise<LearningPathDetail> {
    return apiGet<LearningPathDetail>(`/learning-paths/${idOrCode}`);
  },

  validate(idOrCode: string): Promise<PathValidationResult> {
    return apiGet<PathValidationResult>(
      `/learning-paths/${idOrCode}/validation`,
    );
  },

  create(payload: CreateLearningPathPayload): Promise<LearningPathSummary> {
    return apiPost<LearningPathSummary>('/learning-paths', payload);
  },

  update(
    id: string,
    payload: UpdateLearningPathPayload,
  ): Promise<LearningPathSummary> {
    return apiPut<LearningPathSummary>(`/learning-paths/${id}`, payload);
  },

  archive(id: string): Promise<LearningPathSummary> {
    return apiDelete<LearningPathSummary>(`/learning-paths/${id}`);
  },

  addCourse(
    pathId: string,
    courseId: string,
    stepOrder?: number,
  ): Promise<unknown> {
    return apiPost(`/learning-paths/${pathId}/courses`, {
      courseId,
      stepOrder,
    });
  },

  removeCourse(
    pathId: string,
    courseId: string,
  ): Promise<{ pathId: string; courseId: string; removed: boolean }> {
    return apiDelete(`/learning-paths/${pathId}/courses/${courseId}`);
  },

  reorderCourses(
    pathId: string,
    orderedCourseIds: string[],
  ): Promise<unknown[]> {
    return apiPut(`/learning-paths/${pathId}/courses/order`, {
      orderedCourseIds,
    });
  },
};
