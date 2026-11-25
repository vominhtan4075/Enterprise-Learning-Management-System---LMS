import {
  apiBlob,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  apiUpload,
} from '@/lib/api-client';
import type {
  CourseDetail,
  CourseSummary,
  CreateCoursePayload,
  CreateLessonPayload,
  CreateModulePayload,
  LessonContentResponse,
  LessonItem,
  ModuleItem,
  PaginatedResponse,
  UpdateCoursePayload,
  UpdateLessonPayload,
  UpdateModulePayload,
  UploadedFileMeta,
} from '@/types/api.types';

export const coursesService = {
  getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    isPublished?: boolean | '';
    mine?: boolean;
  }): Promise<PaginatedResponse<CourseSummary>> {
    return apiGet<PaginatedResponse<CourseSummary>>('/courses', params);
  },

  getById(id: string): Promise<CourseDetail> {
    return apiGet<CourseDetail>(`/courses/${id}`);
  },

  create(payload: CreateCoursePayload): Promise<CourseSummary> {
    return apiPost<CourseSummary>('/courses', payload);
  },

  update(id: string, payload: UpdateCoursePayload): Promise<CourseSummary> {
    return apiPut<CourseSummary>(`/courses/${id}`, payload);
  },

  setPublished(id: string, isPublished: boolean): Promise<CourseSummary> {
    return apiPatch<CourseSummary>(`/courses/${id}/publish`, { isPublished });
  },

  remove(id: string): Promise<CourseSummary> {
    return apiDelete<CourseSummary>(`/courses/${id}`);
  },

  // Modules
  createModule(
    courseId: string,
    payload: CreateModulePayload,
  ): Promise<ModuleItem> {
    return apiPost<ModuleItem>(`/courses/${courseId}/modules`, payload);
  },

  updateModule(
    moduleId: string,
    payload: UpdateModulePayload,
  ): Promise<ModuleItem> {
    return apiPut<ModuleItem>(`/modules/${moduleId}`, payload);
  },

  removeModule(moduleId: string): Promise<ModuleItem> {
    return apiDelete<ModuleItem>(`/modules/${moduleId}`);
  },

  reorderModules(courseId: string, orderedIds: string[]): Promise<ModuleItem[]> {
    return apiPut<ModuleItem[]>(`/courses/${courseId}/modules/order`, {
      orderedIds,
    });
  },

  // Lessons
  getLesson(lessonId: string): Promise<LessonItem> {
    return apiGet<LessonItem>(`/lessons/${lessonId}`);
  },

  getLessonContent(lessonId: string): Promise<LessonContentResponse> {
    return apiGet<LessonContentResponse>(`/lessons/${lessonId}/content`);
  },

  createLesson(
    moduleId: string,
    payload: CreateLessonPayload,
  ): Promise<LessonItem> {
    return apiPost<LessonItem>(`/modules/${moduleId}/lessons`, payload);
  },

  updateLesson(
    lessonId: string,
    payload: UpdateLessonPayload,
  ): Promise<LessonItem> {
    return apiPut<LessonItem>(`/lessons/${lessonId}`, payload);
  },

  removeLesson(
    lessonId: string,
  ): Promise<LessonItem & { referencedQuestionsCount?: number }> {
    return apiDelete(`/lessons/${lessonId}`);
  },

  reorderLessons(
    moduleId: string,
    orderedIds: string[],
  ): Promise<LessonItem[]> {
    return apiPut<LessonItem[]>(`/modules/${moduleId}/lessons/order`, {
      orderedIds,
    });
  },

  // Files (PDF)
  uploadPdf(file: File): Promise<UploadedFileMeta> {
    const formData = new FormData();
    formData.append('file', file);
    return apiUpload<UploadedFileMeta>('/files', formData, 'POST');
  },

  fetchPdfBlob(fileIdOrUrl: string): Promise<Blob> {
    const cleanId = fileIdOrUrl
      .replace(/^.*\/api\/v1\/files\//, '')
      .replace(/^\/files\//, '');
    return apiBlob(`/files/${cleanId}`);
  },

  removeFile(fileId: string): Promise<{ id: string; deleted: boolean }> {
    return apiDelete(`/files/${fileId}`);
  },
};
