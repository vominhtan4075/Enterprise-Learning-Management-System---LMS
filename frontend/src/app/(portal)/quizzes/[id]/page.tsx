'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { QUIZ_TYPE_LABELS, formatScore } from '@/lib/formatters';
import { quizzesService } from '@/services/quizzes.service';
import type {
  QuizForTaking,
  SubmitQuizResponse,
  SuggestedLesson,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';

export default function QuizExamPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error: showError, warning } = useToast();

  const [quiz, setQuiz] = useState<QuizForTaking | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitQuizResponse | null>(null);
  const [priorSuggestions, setPriorSuggestions] = useState<SuggestedLesson[]>(
    [],
  );

  const autoSubmitTriggered = useRef(false);
  const isEmployee = user?.role === 'EMPLOYEE';

  const loadQuiz = useCallback(async () => {
    setLoading(true);
    setLockMessage(null);
    try {
      const data = await quizzesService.getForTaking(params.id);
      setQuiz(data);
      if (data.timeLimitMin && data.timeLimitMin > 0 && isEmployee) {
        setSecondsLeft(data.timeLimitMin * 60);
      } else {
        setSecondsLeft(null);
      }
      autoSubmitTriggered.current = false;

      if (
        isEmployee &&
        (data.attemptsUsed ?? 0) > 0 &&
        !data.hasPassed
      ) {
        quizzesService
          .getRetakeSuggestions(params.id)
          .then((s) => setPriorSuggestions(s.suggestedLessons ?? []))
          .catch(() => setPriorSuggestions([]));
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setLockMessage(err.message);
      } else {
        setLockMessage('Không thể tải đề kiểm tra lúc này.');
      }
    } finally {
      setLoading(false);
    }
  }, [params.id, isEmployee]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadQuiz();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadQuiz]);

  const handleSubmit = useCallback(
    async (isAuto = false) => {
      if (!quiz || submitting || result) return;
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
        setResult(res);
        setSecondsLeft(null);
        if (res.isPassed) {
          success(
            `Chúc mừng! Bạn đạt ${formatScore(res.score)}%`,
            'Kết quả đã được đồng bộ vào tiến độ học tập và Ma trận năng lực.',
          );
        } else {
          warning(
            `Chưa đạt điểm chuẩn (${formatScore(res.score)}%)`,
            'Xem danh sách bài học gợi ý ôn tập BR-03 bên dưới trước khi thi lại.',
          );
        }
      } catch (err) {
        showError(
          'Nộp bài thất bại',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [quiz, submitting, result, isEmployee, answers, warning, showError, success],
  );

  // Countdown Timer
  useEffect(() => {
    if (
      secondsLeft === null ||
      result !== null ||
      (quiz?.remainingAttempts !== undefined && quiz.remainingAttempts <= 0)
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
  }, [secondsLeft, result, quiz?.remainingAttempts, handleSubmit]);

  const handleRetake = async () => {
    setResult(null);
    setAnswers({});
    await loadQuiz();
  };

  if (loading) {
    return (
      <div className="space-y-5">
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
        description={lockMessage || 'Vui lòng hoàn thành các bài học bắt buộc trước.'}
        action={
          <Link href={isEmployee ? '/my-learning' : '/courses'}>
            <Button variant="secondary">Quay lại trang học tập</Button>
          </Link>
        }
      />
    );
  }

  const courseId = quiz.module?.courseId;
  const maxAttempts = Number(quiz.maxAttempts ?? 3);
  const attemptsUsed = result ? result.attemptNumber : (quiz.attemptsUsed ?? 0);
  const remainingAttempts = result
    ? (result.remainingAttempts ?? Math.max(0, maxAttempts - result.attemptNumber))
    : (quiz.remainingAttempts ?? Math.max(0, maxAttempts - attemptsUsed));
  const outOfAttempts = isEmployee && remainingAttempts <= 0 && !result;

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {courseId && (
        <Link
          href={`/courses/${courseId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Quay về phòng học khóa học
        </Link>
      )}

      <PageHeader
        title={quiz.title}
        description={`Điểm đạt chuẩn BR-01: >= ${quiz.passingScore}% · Tổng số ${quiz.questions.length} câu hỏi trắc nghiệm`}
        badge={
          <Badge tone={quiz.quizType === 'FINAL' ? 'warning' : 'accent'}>
            {QUIZ_TYPE_LABELS[quiz.quizType]}
          </Badge>
        }
        action={
          secondsLeft !== null && !result && !outOfAttempts ? (
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-sm font-semibold tabular-nums ${
                secondsLeft <= 120
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-[var(--border-default)] bg-white text-[var(--text-primary)]'
              }`}
            >
              <Clock className="h-4 w-4" strokeWidth={1.75} />
              Thời gian còn: {formatTimer(secondsLeft)}
            </div>
          ) : undefined
        }
      />

      {/* Attempt Quota Info Strip */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
          <p className="text-xs text-[var(--text-muted)]">Điểm chuẩn yêu cầu</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
            {quiz.passingScore}%
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
          <p className="text-xs text-[var(--text-muted)]">Số lượt đã làm</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
            {attemptsUsed} / {maxAttempts}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
          <p className="text-xs text-[var(--text-muted)]">Lượt làm còn lại</p>
          <p
            className={`mt-1 text-lg font-semibold tabular-nums ${
              remainingAttempts === 0
                ? 'text-rose-700'
                : 'text-[var(--accent)]'
            }`}
          >
            {remainingAttempts} lượt
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
          <p className="text-xs text-[var(--text-muted)]">Kết quả tốt nhất</p>
          <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
            {quiz.bestScore !== null && quiz.bestScore !== undefined
              ? `${formatScore(quiz.bestScore)}%`
              : 'Chưa thi'}
          </p>
        </div>
      </div>

      {/* Prior BR-03 Retake Suggestions Banner */}
      {!result && priorSuggestions.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            Gợi ý bài học cần xem lại từ lượt thi chưa đạt gần nhất (BR-03):
          </p>
          <div className="flex flex-wrap gap-2">
            {priorSuggestions.map((s) => (
              <Link
                key={s.lessonId}
                href={
                  courseId
                    ? `/courses/${courseId}?lessonId=${s.lessonId}`
                    : '/my-learning'
                }
                className="inline-flex items-center gap-1.5 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
              >
                <BookOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
                {s.lessonTitle}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Submission Result Screen */}
      {result ? (
        <Card>
          <div className="space-y-6">
            <div
              className={`flex flex-col items-start justify-between gap-4 rounded-lg border p-5 sm:flex-row sm:items-center ${
                result.isPassed
                  ? 'border-emerald-200 bg-emerald-50/75'
                  : 'border-rose-200 bg-rose-50/75'
              }`}
            >
              <div className="flex items-start gap-3.5">
                {result.isPassed ? (
                  <CheckCircle2
                    className="h-8 w-8 shrink-0 text-emerald-700 mt-0.5"
                    strokeWidth={1.75}
                  />
                ) : (
                  <XCircle
                    className="h-8 w-8 shrink-0 text-rose-700 mt-0.5"
                    strokeWidth={1.75}
                  />
                )}
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {result.isPassed
                      ? 'Bạn đã vượt qua bài kiểm tra!'
                      : 'Chưa đạt ngưỡng điểm chuẩn 70%'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Lượt làm thứ <strong>{result.attemptNumber}</strong> · Còn
                    lại <strong>{remainingAttempts}</strong> lượt làm bài.
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs uppercase text-[var(--text-muted)]">
                  Điểm số đạt được
                </p>
                <p
                  className={`text-3xl font-semibold tabular-nums ${
                    result.isPassed ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                >
                  {formatScore(result.score)}%
                </p>
              </div>
            </div>

            {!result.isPassed && result.suggestedLessons.length > 0 && (
              <div className="space-y-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Danh sách bài giảng cần ôn tập lại theo câu trả lời sai (Quy tắc
                  BR-03):
                </h3>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {result.suggestedLessons.map((les) => (
                    <Link
                      key={les.lessonId}
                      href={
                        courseId
                          ? `/courses/${courseId}?lessonId=${les.lessonId}`
                          : '/my-learning'
                      }
                      className="flex items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <BookOpen
                          className="h-4 w-4 shrink-0 text-[var(--accent)]"
                          strokeWidth={1.75}
                        />
                        <span className="truncate">{les.lessonTitle}</span>
                      </span>
                      <span className="shrink-0 text-xs text-[var(--accent)]">
                        Ôn lại →
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-default)] pt-4">
              {courseId && (
                <Link href={`/courses/${courseId}`}>
                  <Button variant="secondary">Về trang khóa học</Button>
                </Link>
              )}
              {remainingAttempts > 0 && !result.isPassed && (
                <Button
                  onClick={handleRetake}
                  leftIcon={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Làm lại bài thi ({remainingAttempts} lượt còn lại)
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : outOfAttempts ? (
        <EmptyState
          icon={<XCircle className="h-5 w-5 text-rose-700" strokeWidth={1.75} />}
          title="Bạn đã sử dụng hết số lượt làm bài tối đa"
          description={`Bài kiểm tra này giới hạn tối đa ${maxAttempts} lượt nộp bài. Vui lòng ôn tập lại nội dung hoặc liên hệ Giảng viên / Quản trị viên để được hỗ trợ.`}
          action={
            courseId ? (
              <Link href={`/courses/${courseId}`}>
                <Button variant="secondary">Quay về khóa học</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Questions List */}
          <div className="space-y-4 lg:col-span-8">
            {quiz.questions.map((q, idx) => {
              const chosen = answers[q.id];
              return (
                <div
                  key={q.id}
                  id={`q-${q.id}`}
                  className="rounded-lg border border-[var(--border-default)] bg-white p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] leading-relaxed">
                      <span className="mr-2 font-semibold text-[var(--accent)] tabular-nums">
                        Câu {idx + 1}.
                      </span>
                      {q.questionText}
                    </p>
                    {q.skillName && (
                      <Badge tone="neutral" className="shrink-0">
                        {q.skillName}
                      </Badge>
                    )}
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
                title="Bảng câu hỏi"
                subtitle={`Đã chọn ${Object.keys(answers).length}/${
                  quiz.questions.length
                } câu`}
              >
                <div className="grid grid-cols-5 gap-2">
                  {quiz.questions.map((q, idx) => {
                    const answered = Boolean(answers[q.id]);
                    return (
                      <a
                        key={q.id}
                        href={`#q-${q.id}`}
                        className={`flex h-9 items-center justify-center rounded border text-xs font-semibold tabular-nums transition-colors ${
                          answered
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        {idx + 1}
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
                    {isEmployee ? 'Nộp bài kiểm tra' : 'Xem thử (Chỉ Học viên nộp)'}
                  </Button>
                </div>
              </Card>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
