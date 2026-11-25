import { apiBlob, apiGet, apiPost } from '@/lib/api-client';
import type {
  CompetencyMatrixResponse,
  CompletionReportResponse,
  DashboardResponse,
  PersonalCompetencyResponse,
  PositionLevel,
  QuizScoresReportResponse,
  RecalculateCompetencyResponse,
} from '@/types/api.types';

export const reportsService = {
  getDashboard(params?: {
    from?: string;
    to?: string;
  }): Promise<DashboardResponse> {
    return apiGet<DashboardResponse>('/reports/dashboard', params);
  },

  getCompetencyMatrix(params?: {
    department?: string;
    learningPathId?: string;
    position?: PositionLevel | '';
  }): Promise<CompetencyMatrixResponse> {
    return apiGet<CompetencyMatrixResponse>(
      '/reports/competency-matrix',
      params,
    );
  },

  getMyCompetency(): Promise<PersonalCompetencyResponse> {
    return apiGet<PersonalCompetencyResponse>('/reports/competency-matrix/me');
  },

  exportCompetencyExcel(params?: {
    department?: string;
    learningPathId?: string;
    position?: PositionLevel | '';
  }): Promise<Blob> {
    return apiBlob('/reports/competency-matrix/export', params);
  },

  recalculateCompetency(): Promise<RecalculateCompetencyResponse> {
    return apiPost<RecalculateCompetencyResponse>('/competency/recalculate');
  },

  getCompletion(params?: {
    department?: string;
    position?: PositionLevel | '';
    learningPathId?: string;
    courseId?: string;
  }): Promise<CompletionReportResponse> {
    return apiGet<CompletionReportResponse>('/reports/completion', params);
  },

  getQuizScores(params?: {
    courseId?: string;
    learningPathId?: string;
  }): Promise<QuizScoresReportResponse> {
    return apiGet<QuizScoresReportResponse>('/reports/quiz-scores', params);
  },
};
