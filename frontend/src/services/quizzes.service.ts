import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api-client';
import type {
  CreateQuestionPayload,
  CreateQuizPayload,
  QuestionManageItem,
  QuizForTaking,
  QuizManageDetail,
  SubmitQuizResponse,
  UpdateQuestionPayload,
  UpdateQuizPayload,
} from '@/types/api.types';

export const quizzesService = {
  getForTaking(quizId: string): Promise<QuizForTaking> {
    return apiGet<QuizForTaking>(`/quizzes/${quizId}`);
  },

  getForManage(quizId: string): Promise<QuizManageDetail> {
    return apiGet<QuizManageDetail>(`/quizzes/${quizId}`);
  },

  submit(
    quizId: string,
    answers: Array<{ questionId: string; selectedOption: string }>,
  ): Promise<SubmitQuizResponse> {
    return apiPost<SubmitQuizResponse>(`/quizzes/${quizId}/submit`, {
      answers,
    });
  },

  createForModule(
    moduleId: string,
    payload: CreateQuizPayload,
  ): Promise<QuizManageDetail> {
    return apiPost<QuizManageDetail>(`/modules/${moduleId}/quiz`, payload);
  },

  update(
    quizId: string,
    payload: UpdateQuizPayload,
  ): Promise<QuizManageDetail> {
    return apiPut<QuizManageDetail>(`/quizzes/${quizId}`, payload);
  },

  remove(quizId: string): Promise<{ id: string; message: string }> {
    return apiDelete(`/quizzes/${quizId}`);
  },

  createQuestion(
    quizId: string,
    payload: CreateQuestionPayload,
  ): Promise<QuestionManageItem> {
    return apiPost<QuestionManageItem>(`/quizzes/${quizId}/questions`, payload);
  },

  updateQuestion(
    questionId: string,
    payload: UpdateQuestionPayload,
  ): Promise<QuestionManageItem> {
    return apiPut<QuestionManageItem>(`/questions/${questionId}`, payload);
  },

  removeQuestion(questionId: string): Promise<{ id: string; message: string }> {
    return apiDelete(`/questions/${questionId}`);
  },
};
