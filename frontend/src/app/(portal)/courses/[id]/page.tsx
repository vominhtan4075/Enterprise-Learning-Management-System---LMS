'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Pencil,
  PlayCircle,
  Video,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  CONTENT_TYPE_LABELS,
  QUIZ_TYPE_LABELS,
  formatDateTime,
  formatScore,
  getYoutubeEmbedUrl,
} from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import { progressService } from '@/services/progress.service';
import { quizzesService } from '@/services/quizzes.service';
import type {
  CourseDetail,
  CourseQuizBrief,
  LessonItem,
  QuizForTaking,
} from '@/types/api.types';
import {
  Badge,
  Button,
  EmptyState,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives';

function ClassroomInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const requestedLessonId = searchParams.get('lessonId');
  const requestedQuizId = searchParams.get('quizId');
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [lessonDetail, setLessonDetail] = useState<LessonItem | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [quizUnlockPromptId, setQuizUnlockPromptId] = useState<string | null>(
    null,
  );

  const [quizDetail, setQuizDetail] = useState<QuizForTaking | null>(null);
  const [loadingQuizDetail, setLoadingQuizDetail] = useState(false);

  const isEmployee = user?.role === 'EMPLOYEE';
  const canEdit =
    user?.role === 'ADMIN' ||
    (user?.role === 'TRAINER' && course?.createdById === user.id);

  const selectLesson = useCallback((lessonId: string) => {
    setSelectedQuizId(null);
    setSelectedLessonId(lessonId);
  }, []);

  const selectQuiz = useCallback((quizId: string) => {
    setSelectedLessonId(null);
    setSelectedQuizId(quizId);
    setQuizUnlockPromptId(null);
  }, []);

  const loadCourse = useCallback(
    async (keepSelection = false) => {
      setLoadingCourse(true);
      try {
        const detail = await coursesService.getById(params.id);
        setCourse(detail);

        if (!keepSelection) {
          const allLessons = detail.modules.flatMap((m) => m.lessons);
          const allQuizzes = detail.modules
            .map((m) => m.quiz)
            .filter((q): q is CourseQuizBrief => Boolean(q));

          const requestedQuiz = requestedQuizId
            ? allQuizzes.find(
                (q) =>
                  q.id === requestedQuizId &&
                  (!isEmployee || q.state !== 'LOCKED'),
              )
            : null;

          if (isEmployee && detail.state === 'LOCKED') {
            setSelectedLessonId(null);
            setSelectedQuizId(null);
          } else if (requestedQuiz) {
            setSelectedQuizId(requestedQuiz.id);
            setSelectedLessonId(null);
          } else {
            const requested = requestedLessonId
              ? allLessons.find(
                  (l) =>
                    l.id === requestedLessonId &&
                    (!isEmployee || l.state !== 'LOCKED'),
                )
              : null;
            const firstUnlocked = allLessons.find(
              (l) => l.state === 'UNLOCKED',
            );
            const firstReadable = allLessons.find(
              (l) => !isEmployee || l.state !== 'LOCKED',
            );
            const chosen =
              requested ??
              firstUnlocked ??
              firstReadable ??
              (!isEmployee ? allLessons[0] : null) ??
              null;

            if (chosen) {
              setSelectedLessonId(chosen.id);
              setSelectedQuizId(null);
            } else {
              const fallbackQuiz =
                allQuizzes.find((q) => !isEmployee || q.state !== 'LOCKED') ??
                (!isEmployee ? allQuizzes[0] : null) ??
                null;
              setSelectedQuizId(fallbackQuiz?.id ?? null);
              setSelectedLessonId(null);
            }
          }
        }
      } catch (err) {
        showError(
          'Không thể tải khóa học',
          err instanceof ApiError ? err.message : undefined,
        );
      } finally {
        setLoadingCourse(false);
      }
    },
    [params.id, requestedLessonId, requestedQuizId, isEmployee, showError],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCourse(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCourse]);

  // Load individual lesson content + authenticated PDF Blob if needed
  useEffect(() => {
    let revokedUrl: string | null = null;
    const t = window.setTimeout(() => {
      if (!selectedLessonId) {
        setLessonDetail(null);
        setLessonError(null);
        setPdfBlobUrl(null);
        return;
      }

      setLoadingLesson(true);
      setLessonError(null);
      setPdfBlobUrl(null);

      coursesService
        .getLesson(selectedLessonId)
        .then(async (detail) => {
          setLessonDetail(detail);
          if (detail.contentType === 'PDF') {
            const fileRef = detail.fileId || detail.contentUrl;
            if (fileRef && (detail.fileId || fileRef.includes('/files/'))) {
              const blob = await coursesService.fetchPdfBlob(fileRef);
              revokedUrl = URL.createObjectURL(blob);
              setPdfBlobUrl(revokedUrl);
            }
          }
        })
        .catch((err) => {
          setLessonDetail(null);
          setLessonError(
            err instanceof ApiError
              ? err.message
              : 'Bài học hiện đang bị khóa hoặc không khả dụng.',
          );
        })
        .finally(() => {
          setLoadingLesson(false);
        });
    }, 0);

    return () => {
      window.clearTimeout(t);
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [selectedLessonId]);

  // Load basic Quiz details in the right column when a quiz is selected from the sidebar
  useEffect(() => {
    let active = true;
    const t = window.setTimeout(() => {
      if (!selectedQuizId) {
        setQuizDetail(null);
        setLoadingQuizDetail(false);
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      setLoadingQuizDetail(true);
      setQuizDetail(null);

      quizzesService
        .getForTaking(selectedQuizId)
        .then((data) => {
          if (!active) return;
          setQuizDetail(data);
        })
        .catch(() => {
          // Graceful fallback to CourseQuizBrief from course.modules
        })
        .finally(() => {
          if (active) setLoadingQuizDetail(false);
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [selectedQuizId]);

  useEffect(() => {
    if (selectedLessonId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedLessonId]);

  const handleCompleteLesson = async () => {
    if (!lessonDetail) return;
    setCompleting(true);
    try {
      const res = await progressService.completeLesson(lessonDetail.id);
      setLessonDetail((prev) =>
        prev ? { ...prev, isCompleted: true, state: 'COMPLETED' } : prev,
      );
      await loadCourse(true);

      const parentModule = course?.modules.find(
        (m) => m.id === lessonDetail.moduleId,
      );
      if (res.quizUnlocked && parentModule?.quiz) {
        setQuizUnlockPromptId(parentModule.quiz.id);
        success(
          'Đã hoàn thành bài học!',
          `Bài kiểm tra "${parentModule.quiz.title}" đã được mở khóa.`,
        );
      } else {
        success('Đã ghi nhận hoàn thành bài học.');
        if (res.nextUnlocked?.type === 'LESSON') {
          selectLesson(res.nextUnlocked.id);
        }
      }
    } catch (err) {
      showError(
        'Không thể cập nhật tiến độ',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setCompleting(false);
    }
  };

  if (loadingCourse) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
        <div className="w-full border-b border-[var(--border-default)] p-4 lg:w-[300px] xl:w-[320px] lg:border-b-0 lg:border-r">
          <Skeleton className="h-[480px] w-full" />
        </div>
        <div className="flex-1 px-5 py-5 sm:px-7 lg:px-9">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="mt-6 h-[420px] w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <EmptyState
          title="Không tìm thấy khóa học hoặc chưa được ghi danh"
          description="Vui lòng kiểm tra lại danh sách khóa học được phân công."
          action={
            <Link href={isEmployee ? '/my-learning' : '/courses'}>
              <Button variant="secondary">Quay lại danh sách</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completedLessonsCount = allLessons.filter(
    (l) => l.state === 'COMPLETED' || l.isCompleted,
  ).length;
  const courseProgressPercent =
    allLessons.length > 0
      ? Math.round((completedLessonsCount / allLessons.length) * 100)
      : 0;

  const currentLessonIndex = allLessons.findIndex(
    (l) => l.id === selectedLessonId,
  );
  const prevLesson =
    currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < allLessons.length - 1
      ? allLessons[currentLessonIndex + 1]
      : null;
  const canOpenPrev = Boolean(
    prevLesson && (!isEmployee || prevLesson.state !== 'LOCKED'),
  );
  const canOpenNext = Boolean(
    nextLesson && (!isEmployee || nextLesson.state !== 'LOCKED'),
  );

  const currentModule = lessonDetail
    ? course.modules.find((m) => m.id === lessonDetail.moduleId)
    : null;
  const isLastLessonOfModule = Boolean(
    currentModule &&
      lessonDetail &&
      currentModule.lessons[currentModule.lessons.length - 1]?.id ===
        lessonDetail.id,
  );
  const canOpenModuleQuizFromLesson = Boolean(
    isLastLessonOfModule &&
      currentModule?.quiz &&
      (currentModule.quiz.isPublished || !isEmployee) &&
      (!isEmployee || currentModule.quiz.state !== 'LOCKED') &&
      currentModule.quiz.state !== 'COMPLETED',
  );

  const selectedQuizModule = selectedQuizId
    ? course.modules.find((m) => m.quiz?.id === selectedQuizId) ?? null
    : null;
  const selectedQuizBrief = selectedQuizModule?.quiz ?? null;

  const quizMaxAttempts = Number(
    quizDetail?.maxAttempts ?? selectedQuizBrief?.maxAttempts ?? 3,
  );
  const quizAttemptsUsed = quizDetail?.attemptsUsed ?? 0;
  const quizRemainingAttempts =
    quizDetail?.remainingAttempts ??
    Math.max(0, quizMaxAttempts - quizAttemptsUsed);
  const quizHasPassed = Boolean(
    quizDetail?.hasPassed ?? selectedQuizBrief?.state === 'COMPLETED',
  );
  const quizOutOfAttempts =
    isEmployee && Boolean(quizDetail) && quizRemainingAttempts <= 0;

  const sortedAttemptHistory = [...(quizDetail?.attemptHistory ?? [])].sort(
    (a, b) => b.attemptNumber - a.attemptNumber,
  );

  const quizStartLabel =
    quizDetail && quizDetail.questions.length === 0
      ? 'Chưa có câu hỏi'
      : !isEmployee
        ? 'Xem đề kiểm tra'
        : quizHasPassed || quizAttemptsUsed > 0
          ? 'Làm lại bài'
          : 'Bắt đầu làm bài';

  const youtubeEmbed =
    lessonDetail?.contentType === 'VIDEO'
      ? getYoutubeEmbedUrl(lessonDetail.contentUrl)
      : null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Left Fixed Course & Curriculum Column */}
      <aside className="w-full shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-subtle)]/65 lg:sticky lg:top-16 lg:flex lg:h-[calc(100vh-4rem)] lg:w-[300px] xl:w-[320px] lg:flex-col lg:border-b-0 lg:border-r">
        {/* Course Header inside Left Rail */}
        <div className="shrink-0 border-b border-[var(--border-default)] px-4 py-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
            <Link
              href={isEmployee ? '/my-learning' : '/courses'}
              className="inline-flex items-center gap-1 font-medium hover:text-[var(--accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              {isEmployee ? 'Khóa học của tôi' : 'Kho khóa học'}
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {course.code}
              </span>
              {!isEmployee &&
                (course.isPublished ? (
                  <Badge tone="success">Đã xuất bản</Badge>
                ) : (
                  <Badge tone="warning">Bản nháp</Badge>
                ))}
            </div>
          </div>

          <div>
            <h1 className="text-sm sm:text-base font-bold leading-snug text-[var(--text-primary)]">
              {course.title}
            </h1>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
              {course.description ||
                `Thời lượng: ${course.estimatedHours} giờ · ${allLessons.length} bài giảng`}
            </p>
          </div>

          {isEmployee && allLessons.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                <span>Tiến độ khóa học</span>
                <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                  {completedLessonsCount}/{allLessons.length} bài (
                  {courseProgressPercent}%)
                </span>
              </div>
              <ProgressBar
                value={courseProgressPercent}
                tone={courseProgressPercent === 100 ? 'success' : 'accent'}
              />
            </div>
          )}

          {canEdit && (
            <Link href={`/courses/${course.id}/builder`} className="block pt-0.5">
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                leftIcon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
              >
                Mở Studio biên soạn
              </Button>
            </Link>
          )}
        </div>

        {/* Modules & Lessons List */}
        <div className="flex-1 space-y-3 overflow-y-auto px-2.5 py-3">
          {course.modules.map((mod) => {
            const modLocked = isEmployee && mod.state === 'LOCKED';
            return (
              <div key={mod.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 px-2 pb-0.5">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)] leading-tight">
                      Học phần {mod.moduleOrder}
                      {mod.dayStart && mod.dayEnd
                        ? ` · Ngày ${mod.dayStart}-${mod.dayEnd}`
                        : ''}
                    </p>
                    <h3 className="truncate text-[13px] font-semibold text-[var(--text-primary)] leading-snug">
                      {mod.title}
                    </h3>
                  </div>
                  {mod.state === 'COMPLETED' && (
                    <CheckCircle2
                      className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                      strokeWidth={1.75}
                    />
                  )}
                  {modLocked && (
                    <Lock
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      strokeWidth={1.75}
                    />
                  )}
                </div>

                <div className="space-y-0.5">
                  {mod.lessons.map((les) => {
                    const locked = isEmployee && les.state === 'LOCKED';
                    const done = les.state === 'COMPLETED' || les.isCompleted;
                    const selected =
                      !selectedQuizId && selectedLessonId === les.id;

                    return (
                      <button
                        key={les.id}
                        type="button"
                        disabled={locked}
                        title={
                          locked ? les.lockedReason || 'Đang khóa' : les.title
                        }
                        onClick={() => selectLesson(les.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${locked
                          ? 'cursor-not-allowed opacity-55 text-slate-500'
                          : selected
                            ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-text)] cursor-pointer'
                            : 'text-[var(--text-primary)] hover:bg-white/80 cursor-pointer'
                          }`}
                      >
                        <span className="mt-0.5 shrink-0">
                          {locked ? (
                            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                          ) : done ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-emerald-600"
                              strokeWidth={1.75}
                            />
                          ) : les.contentType === 'VIDEO' ? (
                            <Video className="h-3.5 w-3.5" strokeWidth={1.75} />
                          ) : (
                            <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] leading-snug">
                            {les.lessonOrder}. {les.title}
                          </p>
                          <p className="text-[11px] leading-tight text-[var(--text-muted)]">
                            {CONTENT_TYPE_LABELS[les.contentType]} ·{' '}
                            {les.durationMinutes} phút
                            {!les.isRequired ? ' · Tự chọn' : ''}
                          </p>
                          {locked && les.lockedReason && (
                            <p className="mt-0.5 text-[11px] text-amber-700">
                              {les.lockedReason}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Module Quiz Entry */}
                  {mod.quiz && (mod.quiz.isPublished || !isEmployee) && (
                    <div className="mt-1">
                      {isEmployee && mod.quiz.state === 'LOCKED' ? (
                        <div className="rounded-md border border-dashed border-[var(--border-strong)] bg-white/55 px-2.5 py-1.5 space-y-0.5 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Lock
                              className="h-3.5 w-3.5 shrink-0"
                              strokeWidth={1.75}
                            />
                            <span className="truncate">{mod.quiz.title}</span>
                          </div>
                          {mod.quiz.lockedReason && (
                            <p className="text-[11px] text-amber-700">
                              {mod.quiz.lockedReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selectQuiz(mod.quiz!.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                            selectedQuizId === mod.quiz.id
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-text)]'
                              : 'border-dashed border-[var(--border-strong)] bg-white/75 text-[var(--text-primary)] hover:bg-white'
                          }`}
                        >
                          <span className="flex min-w-0 items-start gap-1.5">
                            {mod.quiz.state === 'COMPLETED' ? (
                              <CheckCircle2
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                                strokeWidth={1.75}
                              />
                            ) : (
                              <ClipboardCheck
                                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]"
                                strokeWidth={1.75}
                              />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {mod.quiz.title}
                              </span>
                              <span className="block text-[11px] font-normal text-[var(--text-muted)]">
                                {QUIZ_TYPE_LABELS[mod.quiz.quizType]} ·{' '}
                                {mod.quiz.timeLimitMin &&
                                mod.quiz.timeLimitMin > 0
                                  ? `${mod.quiz.timeLimitMin} phút`
                                  : 'Không giới hạn'}
                              </span>
                            </span>
                          </span>
                          <Badge
                            tone={
                              mod.quiz.state === 'COMPLETED'
                                ? 'success'
                                : 'accent'
                            }
                            className="shrink-0"
                          >
                            {mod.quiz.state === 'COMPLETED'
                              ? 'Đã đạt'
                              : isEmployee
                                ? 'Kiểm tra'
                                : 'Xem đề'}
                          </Badge>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Column: Quiz Basic Info OR Open Lesson Content */}
      <section className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-7 lg:px-9 space-y-4">
          {isEmployee && course.state === 'LOCKED' ? (
            <EmptyState
              icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
              title="Khóa học đang bị khóa theo lộ trình (BR-02)"
              description={
                course.lockedReason ||
                'Bạn cần hoàn thành đầy đủ các khóa học và bài kiểm tra ở các chặng phía trước trong lộ trình trước khi học khóa học này.'
              }
              action={
                <Link href="/my-learning">
                  <Button variant="secondary">Quay về Khóa học của tôi</Button>
                </Link>
              }
            />
          ) : (
            <>
              {quizUnlockPromptId && !selectedQuizId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
              <div className="text-sm text-[var(--accent-text)]">
                <strong>Chúc mừng!</strong> Bạn đã hoàn thành toàn bộ bài giảng
                bắt buộc trong học phần và mở khóa bài kiểm tra đánh giá.
              </div>
              <Button
                size="sm"
                onClick={() => selectQuiz(quizUnlockPromptId)}
              >
                Xem bài kiểm tra →
              </Button>
            </div>
          )}

          {selectedQuizBrief && selectedQuizModule ? (
            <div className="space-y-5">
              {/* Quiz Header + Primary Action */}
              <header className="flex flex-col gap-3 border-b border-[var(--border-default)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        selectedQuizBrief.quizType === 'FINAL'
                          ? 'warning'
                          : 'accent'
                      }
                    >
                      {QUIZ_TYPE_LABELS[selectedQuizBrief.quizType]}
                    </Badge>

                    {isEmployee ? (
                      quizHasPassed ? (
                        <Badge tone="success">Đã đạt</Badge>
                      ) : quizAttemptsUsed > 0 ? (
                        <Badge tone="warning">Chưa đạt</Badge>
                      ) : (
                        <Badge tone="neutral">Chưa làm</Badge>
                      )
                    ) : (
                      <Badge
                        tone={
                          selectedQuizBrief.isPublished ? 'success' : 'neutral'
                        }
                      >
                        {selectedQuizBrief.isPublished
                          ? 'Đã xuất bản'
                          : 'Bản nháp'}
                      </Badge>
                    )}

                    <span className="text-xs text-[var(--text-muted)]">
                      Học phần {selectedQuizModule.moduleOrder}:{' '}
                      {selectedQuizModule.title}
                    </span>
                  </div>

                  <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] leading-snug">
                    {selectedQuizBrief.title}
                  </h2>
                </div>

                <div className="shrink-0">
                  {quizOutOfAttempts ? (
                    <Badge tone="danger">
                      Đã hết lượt làm bài ({quizMaxAttempts}/{quizMaxAttempts})
                    </Badge>
                  ) : (
                    <Link href={`/quizzes/${selectedQuizBrief.id}?start=1`}>
                      <Button
                        size="md"
                        disabled={Boolean(
                          quizDetail && quizDetail.questions.length === 0,
                        )}
                        leftIcon={
                          <PlayCircle className="h-4 w-4" strokeWidth={1.75} />
                        }
                      >
                        {quizStartLabel}
                      </Button>
                    </Link>
                  )}
                </div>
              </header>

              {/* 4-Card Basic Info Strip */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
                  <p className="text-xs text-[var(--text-muted)]">Số câu hỏi</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                    {loadingQuizDetail && !quizDetail
                      ? '...'
                      : quizDetail
                        ? `${quizDetail.questions.length} câu`
                        : '—'}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
                  <p className="text-xs text-[var(--text-muted)]">Thời gian</p>
                  <p className="mt-1 flex items-center gap-1.5 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                    <Clock
                      className="h-4 w-4 text-[var(--text-muted)]"
                      strokeWidth={1.75}
                    />
                    {selectedQuizBrief.timeLimitMin &&
                    selectedQuizBrief.timeLimitMin > 0
                      ? `${selectedQuizBrief.timeLimitMin} phút`
                      : 'Không giới hạn'}
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
                  <p className="text-xs text-[var(--text-muted)]">
                    Điểm chuẩn đạt
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text-primary)] tabular-nums">
                    &ge; {selectedQuizBrief.passingScore}%
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--border-default)] bg-white p-3.5">
                  <p className="text-xs text-[var(--text-muted)]">
                    {isEmployee ? 'Số lượt làm' : 'Giới hạn lượt'}
                  </p>
                  <p
                    className={`mt-1 text-lg font-semibold tabular-nums ${
                      quizOutOfAttempts
                        ? 'text-rose-700'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {isEmployee && quizDetail
                      ? `Đã làm ${quizAttemptsUsed} / ${quizMaxAttempts}`
                      : `Tối đa ${quizMaxAttempts} lượt`}
                  </p>
                </div>
              </div>

              {/* Attempt History Table */}
              {isEmployee && (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      Lịch sử làm bài
                    </h3>
                    {quizDetail?.bestScore !== null &&
                      quizDetail?.bestScore !== undefined && (
                        <span className="text-xs text-[var(--text-secondary)]">
                          Điểm cao nhất:{' '}
                          <strong className="text-[var(--text-primary)] tabular-nums">
                            {formatScore(quizDetail.bestScore)}%
                          </strong>
                        </span>
                      )}
                  </div>

                  {loadingQuizDetail && !quizDetail ? (
                    <Skeleton className="h-24 w-full" />
                  ) : sortedAttemptHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-[var(--border-default)] bg-white px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      Bạn chưa thực hiện bài kiểm tra này lần nào.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-white">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-secondary)]">
                          <tr>
                            <th className="px-4 py-2.5">Lần làm</th>
                            <th className="px-4 py-2.5">Thời gian nộp</th>
                            <th className="px-4 py-2.5 text-right">Điểm số</th>
                            <th className="px-4 py-2.5 text-right">Kết quả</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-default)]">
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
                                <Badge
                                  tone={att.isPassed ? 'success' : 'danger'}
                                >
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
          ) : loadingLesson ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-[460px] w-full" />
            </div>
          ) : lessonError ? (
            <EmptyState
              icon={<Lock className="h-5 w-5" strokeWidth={1.75} />}
              title="Nội dung bài học đang bị khóa"
              description={lessonError}
            />
          ) : !lessonDetail ? (
            <EmptyState
              icon={<PlayCircle className="h-5 w-5" strokeWidth={1.75} />}
              title="Chọn một bài giảng ở danh mục bên trái"
              description="Hoàn thành lần lượt các bài học để mở khóa đề kiểm tra cuối học phần."
            />
          ) : (
            <div className="space-y-4">
              <header className="border-b border-[var(--border-default)] pb-3.5">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">
                    {CONTENT_TYPE_LABELS[lessonDetail.contentType]}
                  </Badge>
                  <span className="text-xs text-[var(--text-muted)]">
                    Thời lượng {lessonDetail.durationMinutes} phút
                  </span>
                </div>
                <h2 className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)] leading-snug">
                  {lessonDetail.title}
                </h2>
              </header>

              {/* VIDEO Player */}
              {lessonDetail.contentType === 'VIDEO' && (
                <div className="space-y-4">
                  {youtubeEmbed ? (
                    <div className="aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-default)] bg-black">
                      <iframe
                        src={youtubeEmbed}
                        title={lessonDetail.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="h-full w-full"
                      />
                    </div>
                  ) : lessonDetail.contentUrl ? (
                    <div className="space-y-3">
                      <video
                        controls
                        src={lessonDetail.contentUrl}
                        className="aspect-video w-full rounded-xl border border-[var(--border-default)] bg-black"
                      />
                      <a
                        href={lessonDetail.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
                      >
                        <ExternalLink
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                        Mở nguồn video trong tab mới
                      </a>
                    </div>
                  ) : null}

                  {lessonDetail.contentText && (
                    <div className="lms-markdown text-[15.5px]">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {lessonDetail.contentText}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* PDF Viewer */}
              {lessonDetail.contentType === 'PDF' && (
                <div className="space-y-4">
                  {pdfBlobUrl ? (
                    <>
                      <div className="flex items-center justify-end gap-3">
                        <a
                          href={pdfBlobUrl}
                          download={`${lessonDetail.title}.pdf`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                        >
                          <Download
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                          Tải PDF về máy
                        </a>
                        <a
                          href={pdfBlobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                        >
                          <ExternalLink
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                          Mở rộng toàn màn hình
                        </a>
                      </div>
                      <iframe
                        src={pdfBlobUrl}
                        title={lessonDetail.title}
                        className="h-[78vh] min-h-[640px] w-full rounded-xl border border-[var(--border-default)] bg-white"
                      />
                    </>
                  ) : lessonDetail.contentUrl?.startsWith('http') ? (
                    <iframe
                      src={lessonDetail.contentUrl}
                      title={lessonDetail.title}
                      className="h-[78vh] min-h-[640px] w-full rounded-xl border border-[var(--border-default)] bg-white"
                    />
                  ) : (
                    <p className="py-12 text-center text-sm text-[var(--text-muted)]">
                      Đang chuẩn bị luồng tài liệu PDF bảo mật...
                    </p>
                  )}
                </div>
              )}

              {/* MARKDOWN Reader — Directly on the open page */}
              {lessonDetail.contentType === 'MARKDOWN' && (
                <article className="lms-markdown text-[15.5px] leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {lessonDetail.contentText ||
                      '_Bài học chưa có nội dung văn bản._'}
                  </ReactMarkdown>
                </article>
              )}

              {/* Bottom Lesson Complete & Prev/Next Bar */}
              {(isEmployee ||
                prevLesson ||
                nextLesson ||
                canOpenModuleQuizFromLesson) && (
                <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-default)] pt-4 sm:grid-cols-3 sm:items-center">
                  <div className="flex justify-center sm:justify-start">
                    {prevLesson && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canOpenPrev}
                        onClick={() => selectLesson(prevLesson.id)}
                        leftIcon={
                          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                        }
                      >
                        Bài trước
                      </Button>
                    )}
                  </div>

                  <div className="flex justify-center">
                    {isEmployee &&
                      (lessonDetail.isCompleted ||
                        lessonDetail.state === 'COMPLETED' ? (
                        <span className="inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-700">
                          <CheckCircle2
                            className="h-4 w-4"
                            strokeWidth={1.75}
                          />
                          Đã hoàn thành bài học
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={handleCompleteLesson}
                          loading={completing}
                        >
                          <CheckCircle2
                            className="h-4 w-4"
                            strokeWidth={1.75}
                          />
                          Đánh dấu hoàn thành
                        </Button>
                      ))}
                  </div>

                  <div className="flex justify-center sm:justify-end">
                    {canOpenModuleQuizFromLesson && currentModule?.quiz ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => selectQuiz(currentModule.quiz!.id)}
                      >
                        Bài kiểm tra học phần
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    ) : (
                      nextLesson && (
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!canOpenNext}
                          title={
                            !canOpenNext
                              ? 'Hoàn thành bài học hiện tại để mở bài tiếp theo'
                              : nextLesson.title
                          }
                          onClick={() => selectLesson(nextLesson.id)}
                        >
                          Bài tiếp theo
                          <ArrowRight
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default function CourseClassroomPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-[480px] w-full" />
        </div>
      }
    >
      <ClassroomInner />
    </Suspense>
  );
}
