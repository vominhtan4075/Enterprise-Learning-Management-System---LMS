'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Flag,
  Lock,
  Send,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { formatScore } from '@/lib/formatters';
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

function QuizExamInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoStart = searchParams.get('start') === '1';

  const { user } = useAuth();
  const { success, error: showError, warning } = useToast();

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) return;
    let active = true;

    const timer = window.setTimeout(() => {
      setLoading(true);
      setRedirecting(false);
      setLockMessage(null);
      setAnswers({});
      setFlaggedIds({});
      setSecondsLeft(null);
      autoSubmitTriggered.current = false;
      hasSubmittedRef.current = false;

      quizzesService
        .getForTaking(params.id)
        .then((data) => {
          if (!active) return;

          const targetCourseId = data.module?.courseId;
          const fallbackHref = targetCourseId
            ? `/courses/${targetCourseId}?quizId=${data.id}`
            : isEmployee
              ? '/my-learning'
              : '/courses';

          const maxAtt = Number(data.maxAttempts ?? 3);
          const used = data.attemptsUsed ?? 0;
          const rem = data.remainingAttempts ?? Math.max(0, maxAtt - used);
          const cannotTake =
            !autoStart ||
            (isEmployee && rem <= 0) ||
            data.questions.length === 0;

          if (cannotTake) {
            setRedirecting(true);
            router.replace(fallbackHref);
            return;
          }

          setQuiz(data);
          if (isEmployee && data.timeLimitMin && data.timeLimitMin > 0) {
            setSecondsLeft(data.timeLimitMin * 60);
          } else {
            setSecondsLeft(null);
          }
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (!active) return;
          if (!autoStart) {
            setRedirecting(true);
            router.replace(isEmployee ? '/my-learning' : '/courses');
            return;
          }
          if (err instanceof ApiError) {
            setLockMessage(err.message);
          } else {
            setLockMessage('Không thể tải đề kiểm tra lúc này.');
          }
          setLoading(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [user, params.id, autoStart, isEmployee, router]);

  const courseId = quiz?.module?.courseId;
  const backHref = courseId && quiz
    ? `/courses/${courseId}?quizId=${quiz.id}`
    : isEmployee
      ? '/my-learning'
      : '/courses';

  const handleExitExam = () => {
    if (Object.keys(answers).length > 0) {
      const confirmed = window.confirm(
        'Bạn đang làm dở bài kiểm tra. Quay lại trang lớp học sẽ hủy các đáp án đã chọn. Tiếp tục?',
      );
      if (!confirmed) return;
    }
    setSecondsLeft(null);
    setAnswers({});
    setFlaggedIds({});
    autoSubmitTriggered.current = false;
    hasSubmittedRef.current = false;
    router.push(backHref);
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
        const destination = targetCourseId
          ? `/courses/${targetCourseId}?quizId=${quiz.id}`
          : isEmployee
            ? '/my-learning'
            : '/courses';
        router.replace(destination);
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
      warning,
      showError,
      success,
    ],
  );

  // Countdown Timer (runs during active exam session)
  useEffect(() => {
    if (
      loading ||
      redirecting ||
      !quiz ||
      secondsLeft === null ||
      hasSubmittedRef.current
    ) {
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
  }, [loading, redirecting, quiz, secondsLeft, handleSubmit]);

  if (loading || redirecting) {
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

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={handleExitExam}
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
                className={`rounded-lg border bg-white p-5 space-y-4 ${
                  isFlagged
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
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      isFlagged
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
                      className={`h-3.5 w-3.5 ${
                        isFlagged ? 'fill-amber-500 text-amber-600' : ''
                      }`}
                      strokeWidth={1.75}
                    />
                    <span>Đánh dấu</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(q.options ?? []).map((opt) => {
                    const active = chosen === opt.key;
                    return (
                      <label
                        key={opt.key}
                        className={`flex items-start gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors cursor-pointer ${
                          active
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
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold tabular-nums ${
                      secondsLeft <= 120
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
