'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Flag,
  Lock,
  PlayCircle,
  Send,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  formatDateTime,
  formatScore,
} from '@/lib/formatters';
import { quizzesService } from '@/services/quizzes.service';
import type { QuizForTaking } from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

type QuizStage = 'overview' | 'taking';

function QuizExamInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('start') === '1';

  const { user } = useAuth();
  const { success, error: showError, warning } = useToast();

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const [stage, setStage] = useState<QuizStage>('overview');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autoSubmitTriggered = useRef(false);
  const hasSubmittedRef = useRef(false);
  const isEmployee = user?.role === 'EMPLOYEE';

  const toggleFlag = (questionId: string) => {
    setFlaggedIds((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const loadQuiz = useCallback(async (): Promise<QuizForTaking | null> => {
    setLoading(true);
    setLockMessage(null);
    setSecondsLeft(null);
    try {
      const data = await quizzesService.getForTaking(params.id);
      setQuiz(data);
      autoSubmitTriggered.current = false;
      return data;
    } catch (err) {
      if (err instanceof ApiError) {
        setLockMessage(err.message);
      } else {
        setLockMessage('Không thể tải đề kiểm tra lúc này.');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const startExamSession = useCallback(
    (targetQuiz: QuizForTaking) => {
      const maxAtt = Number(targetQuiz.maxAttempts ?? 3);
      const used = targetQuiz.attemptsUsed ?? 0;
      const rem = targetQuiz.remainingAttempts ?? Math.max(0, maxAtt - used);

      if ((isEmployee && rem <= 0) || targetQuiz.questions.length === 0) {
        return;
      }

      setAnswers({});
      setFlaggedIds({});
      autoSubmitTriggered.current = false;
      hasSubmittedRef.current = false;

      if (isEmployee && targetQuiz.timeLimitMin && targetQuiz.timeLimitMin > 0) {
        setSecondsLeft(targetQuiz.timeLimitMin * 60);
      } else {
        setSecondsLeft(null);
      }

      setStage('taking');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [isEmployee],
  );

  useEffect(() => {
    let active = true;
    const t = window.setTimeout(() => {
      setStage('overview');
      setAnswers({});
      setFlaggedIds({});
      setSecondsLeft(null);
      hasSubmittedRef.current = false;
      loadQuiz().then((data) => {
        if (!active || !data) return;
        if (autoStart) {
          startExamSession(data);
        }
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [loadQuiz, autoStart, startExamSession]);

  const handleBackToOverview = () => {
    if (Object.keys(answers).length > 0) {
      const confirmed = window.confirm(
        'Bạn đang làm dở bài kiểm tra. Quay lại màn hình thông tin sẽ hủy các đáp án đã chọn. Tiếp tục?',
      );
      if (!confirmed) return;
    }
    setSecondsLeft(null);
    setAnswers({});
    setFlaggedIds({});
    autoSubmitTriggered.current = false;
    hasSubmittedRef.current = false;

    const targetCourseId = quiz?.module?.courseId;
    if (targetCourseId && quiz) {
      router.push(`/courses/${targetCourseId}?quizId=${quiz.id}`);
    } else {
      setStage('overview');
    }
  };

  const handleSubmit = useCallback(
    async (isAuto = false) => {
      if (!quiz || submitting || hasSubmittedRef.current) return;
      if (!isEmployee) {
        warning(
          'Chế độ xem trước',
          'Chỉ tài khoản Học viên (EMPLOYEE) mới thực hiện nộp bài tính điểm chính thức.',
        );
        return;
      }

      const formattedAnswers = quiz.questions.map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id] || '',
      }));

      if (!isAuto) {
        const unanswered = formattedAnswers.filter(
          (a) => !a.selectedOption,
        ).length;
        if (unanswered > 0) {
          showError(
            `Còn ${unanswered} câu hỏi chưa chọn đáp án`,
            'Vui lòng hoàn thành tất cả các câu hỏi trước khi nộp bài.',
          );
          return;
        }
      }

      setSubmitting(true);
      try {
        const res = await quizzesService.submit(quiz.id, formattedAnswers);
        hasSubmittedRef.current = true;
        setSecondsLeft(null);

        if (res.isPassed) {
          success(
            `Chúc mừng! Bạn đạt ${formatScore(res.score)}%`,
            'Kết quả đã được đồng bộ vào tiến độ học tập và Ma trận năng lực.',
          );
        } else {
          warning(
            `Chưa đạt điểm chuẩn (${formatScore(res.score)}%)`,
            'Bạn có thể ôn lại các bài giảng trong học phần trước khi thực hiện làm lại.',
          );
        }

        const targetCourseId = quiz.module?.courseId;
        if (targetCourseId) {
          router.replace(`/courses/${targetCourseId}?quizId=${quiz.id}`);
          return;
        }

        setStage('overview');
        setAnswers({});
        setFlaggedIds({});
        await loadQuiz();
        setSubmitting(false);
      } catch (err) {
        showError(
          'Nộp bài thất bại',
          err instanceof ApiError ? err.message : undefined,
        );
        setSubmitting(false);
      }
    },
    [
      quiz,
      submitting,
      isEmployee,
      answers,
      router,
      loadQuiz,
      warning,
      showError,
      success,
    ],
  );

  // Countdown Timer (runs only during active exam stage)
  useEffect(() => {
    if (stage !== 'taking' || secondsLeft === null || hasSubmittedRef.current) {
      return;
    }

    if (secondsLeft <= 0) {
      if (!autoSubmitTriggered.current) {
        autoSubmitTriggered.current = true;
        void handleSubmit(true);
      }
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((s) => (s !== null ? s - 1 : null));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [stage, secondsLeft, handleSubmit]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (lockMessage || !quiz) {
    return (
      <EmptyState
        icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
        title="Bài kiểm tra đang bị khóa hoặc chưa khả dụng"
        description={
          lockMessage || 'Vui lòng hoàn thành các bài học bắt buộc trước.'
        }
        action={
          <Link href={isEmployee ? '/my-learning' : '/courses'}>
            <Button variant="secondary">Quay lại trang học tập</Button>
          </Link>
        }
      />
    );
  }

  const courseId = quiz.module?.courseId;
  const backHref = courseId
    ? `/courses/${courseId}?quizId=${quiz.id}`
    : isEmployee
      ? '/my-learning'
      : '/courses';

  const maxAttempts = Number(quiz.maxAttempts ?? 3);
  const attemptsUsed = quiz.attemptsUsed ?? 0;
  const remainingAttempts =
    quiz.remainingAttempts ?? Math.max(0, maxAttempts - attemptsUsed);
  const outOfAttempts = isEmployee && remainingAttempts <= 0;

  const sortedAttemptHistory = [...(quiz.attemptHistory ?? [])].sort(
    (a, b) => b.attemptNumber - a.attemptNumber,
  );

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ===========================================================================
  // STAGE 1: QUIZ DETAIL / OVERVIEW (Fallback when accessed directly without ?start=1)
  // ===========================================================================
  if (stage === 'overview') {
    const startButtonLabel =
      quiz.questions.length === 0
        ? 'Chưa có câu hỏi'
        : !isEmployee
          ? 'Xem đề kiểm tra'
          : quiz.hasPassed || attemptsUsed > 0
            ? 'Làm lại bài'
            : 'Bắt đầu làm bài';

    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          {courseId ? 'Quay về phòng học khóa học' : 'Quay lại'}
        </Link>

        <div className="rounded-xl border border-[var(--border-default)] bg-white p-6 sm:p-7 space-y-5">
          <div className="flex flex-col gap-3 border-b border-[var(--border-default)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">Bài kiểm tra</Badge>
                {isEmployee ? (
                  quiz.hasPassed ? (
                    <Badge tone="success">Đã đạt</Badge>
                  ) : attemptsUsed > 0 ? (
                    <Badge tone="warning">Chưa đạt</Badge>
                  ) : (
                    <Badge tone="neutral">Chưa làm</Badge>
                  )
                ) : (
                  <Badge tone={quiz.isPublished ? 'success' : 'neutral'}>
                    {quiz.isPublished ? 'Đã xuất bản' : 'Bản nháp'}
                  </Badge>
                )}
              </div>

              <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                {quiz.title}
              </h1>

              {quiz.module && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Học phần {quiz.module.moduleOrder}: {quiz.module.title}
                  {quiz.module.course
                    ? ` · [${quiz.module.course.code}] ${quiz.module.course.title}`
                    : ''}
                </p>
              )}
            </div>

            <div className="shrink-0">
              {outOfAttempts ? (
                <Badge tone="danger">
                  Đã hết lượt làm bài ({maxAttempts}/{maxAttempts})
                </Badge>
              ) : (
                <Button
                  size="md"
                  disabled={quiz.questions.length === 0}
                  onClick={() => startExamSession(quiz)}
                  leftIcon={
                    <PlayCircle className="h-4 w-4" strokeWidth={1.75} />
                  }
                >
                  {startButtonLabel}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Số câu hỏi</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                {quiz.questions.length} câu
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Thời gian</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                {quiz.timeLimitMin && quiz.timeLimitMin > 0
                  ? `${quiz.timeLimitMin} phút`
                  : 'Không giới hạn'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-3.5">
              <p className="text-xs text-[var(--text-muted)]">Điểm chuẩn đạt</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                &ge; {quiz.passingScore}%
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-3.5">
              <p className="text-xs text-[var(--text-muted)]">
                {isEmployee ? 'Số lượt làm' : 'Giới hạn lượt'}
              </p>
              <p
                className={`mt-1 text-lg font-semibold tabular-nums ${outOfAttempts ? 'text-rose-700' : 'text-[var(--text-primary)]'
                  }`}
              >
                {isEmployee
                  ? `Đã làm ${attemptsUsed} / ${maxAttempts}`
                  : `Tối đa ${maxAttempts} lượt`}
              </p>
            </div>
          </div>

          {isEmployee && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Lịch sử làm bài
                </h2>
                {quiz.bestScore !== null && quiz.bestScore !== undefined && (
                  <span className="text-xs text-[var(--text-secondary)]">
                    Điểm cao nhất:{' '}
                    <strong className="text-[var(--text-primary)] tabular-nums">
                      {formatScore(quiz.bestScore)}%
                    </strong>
                  </span>
                )}
              </div>

              {sortedAttemptHistory.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[var(--border-default)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  Bạn chưa thực hiện bài kiểm tra này lần nào.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[var(--border-default)]">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                      <tr>
                        <th className="px-4 py-2.5">Lần làm</th>
                        <th className="px-4 py-2.5">Thời gian nộp</th>
                        <th className="px-4 py-2.5 text-right">Điểm số</th>
                        <th className="px-4 py-2.5 text-right">Kết quả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-default)] bg-white">
                      {sortedAttemptHistory.map((att) => (
                        <tr key={att.id}>
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)] tabular-nums">
                            Lần {att.attemptNumber}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--text-secondary)] tabular-nums">
                            {formatDateTime(att.submittedAt)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                            {formatScore(att.score)}%
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Badge tone={att.isPassed ? 'success' : 'danger'}>
                              {att.isPassed ? 'Đạt' : 'Chưa đạt'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===========================================================================
  // STAGE 2: ACTIVE EXAM VIEW (stage === 'taking')
  // ===========================================================================
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleBackToOverview}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Thông tin bài kiểm tra
      </button>

      <PageHeader
        title={quiz.title}
        description={`Điểm đạt: >= ${quiz.passingScore}% · ${quiz.questions.length} câu hỏi trắc nghiệm`}
        badge={<Badge tone="accent">Bài kiểm tra</Badge>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Questions List */}
        <div className="space-y-4 lg:col-span-8">
          {quiz.questions.map((q, idx) => {
            const isFlagged = Boolean(flaggedIds[q.id]);
            const chosen = answers[q.id];
            return (
              <div
                key={q.id}
                id={`q-${q.id}`}
                className={`rounded-lg border bg-white p-5 space-y-4 ${isFlagged
                  ? 'border-amber-300'
                  : 'border-[var(--border-default)]'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] leading-relaxed">
                    <span className="mr-2 font-semibold text-[var(--accent)] tabular-nums">
                      Câu {idx + 1}.
                    </span>
                    {q.questionText}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleFlag(q.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${isFlagged
                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                      : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    title={
                      isFlagged
                        ? 'Bỏ đánh dấu câu hỏi này'
                        : 'Đánh dấu để xem lại sau'
                    }
                  >
                    <Flag
                      className={`h-3.5 w-3.5 ${isFlagged ? 'fill-amber-500 text-amber-600' : ''
                        }`}
                      strokeWidth={1.75}
                    />
                    <span>{isFlagged ? 'Đánh dấu' : 'Đánh dấu'}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => {
                    const active = chosen === opt.key;
                    return (
                      <label
                        key={opt.key}
                        className={`flex items-start gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${active
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)]/55 font-medium text-[var(--text-primary)]'
                          : 'border-[var(--border-default)] bg-white hover:bg-[var(--bg-subtle)]'
                          }`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.key}
                          checked={active}
                          onChange={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [q.id]: opt.key,
                            }))
                          }
                          className="mt-1 accent-[var(--accent)]"
                        />
                        <span>
                          <strong className="mr-1.5">{opt.key}.</strong>
                          {opt.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Question Navigator + Submit */}
        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-4">
            <Card
              title="Câu hỏi"
              action={
                secondsLeft !== null ? (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums ${secondsLeft <= 120
                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                      : 'border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                      }`}
                    title="Thời gian làm bài còn lại"
                  >
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>{formatTimer(secondsLeft)}</span>
                  </div>
                ) : undefined
              }
            >
              <div className="grid grid-cols-5 gap-2">
                {quiz.questions.map((q, idx) => {
                  const answered = Boolean(answers[q.id]);
                  const isFlagged = Boolean(flaggedIds[q.id]);
                  const tileStyle =
                    answered && isFlagged
                      ? 'border-amber-500 bg-[var(--accent)] text-white ring-2 ring-amber-200'
                      : !answered && isFlagged
                        ? 'border-amber-400 bg-amber-50 text-amber-900'
                        : answered
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]';

                  return (
                    <a
                      key={q.id}
                      href={`#q-${q.id}`}
                      className={`relative flex h-9 items-center justify-center rounded border text-xs font-semibold tabular-nums transition-colors ${tileStyle}`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-white bg-amber-500" />
                      )}
                    </a>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-[var(--border-default)] pt-4">
                <Button
                  size="lg"
                  className="w-full"
                  loading={submitting}
                  onClick={() => handleSubmit(false)}
                  leftIcon={<Send className="h-4 w-4" strokeWidth={1.75} />}
                >
                  {isEmployee
                    ? 'Nộp bài'
                    : 'Xem thử (Chỉ Học viên nộp)'}
                </Button>
              </div>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function QuizExamPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl space-y-5">
          <Skeleton className="h-14 w-2/3" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <QuizExamInner />
    </Suspense>
  );
}
