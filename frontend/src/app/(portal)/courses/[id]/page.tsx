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
import { CONTENT_TYPE_LABELS, getYoutubeEmbedUrl } from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import { progressService } from '@/services/progress.service';
import type { CourseDetail, LessonItem } from '@/types/api.types';
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
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loadingCourse, setLoadingCourse] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonDetail, setLessonDetail] = useState<LessonItem | null>(null);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [quizUnlockPromptId, setQuizUnlockPromptId] = useState<string | null>(
    null,
  );

  const isEmployee = user?.role === 'EMPLOYEE';
  const canEdit =
    user?.role === 'ADMIN' ||
    (user?.role === 'TRAINER' && course?.createdById === user.id);

  const loadCourse = useCallback(
    async (keepSelection = false) => {
      setLoadingCourse(true);
      try {
        const detail = await coursesService.getById(params.id);
        setCourse(detail);

        if (!keepSelection) {
          const allLessons = detail.modules.flatMap((m) => m.lessons);
          const requested = requestedLessonId
            ? allLessons.find(
                (l) => l.id === requestedLessonId && l.state !== 'LOCKED',
              )
            : null;
          const firstUnlocked = allLessons.find((l) => l.state === 'UNLOCKED');
          const firstReadable = allLessons.find((l) => l.state !== 'LOCKED');
          const chosen =
            requested ?? firstUnlocked ?? firstReadable ?? allLessons[0] ?? null;
          setSelectedLessonId(chosen ? chosen.id : null);
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
    [params.id, requestedLessonId, showError],
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
          setSelectedLessonId(res.nextUnlocked.id);
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
                    const selected = selectedLessonId === les.id;

                    return (
                      <button
                        key={les.id}
                        type="button"
                        disabled={locked}
                        title={
                          locked ? les.lockedReason || 'Đang khóa' : les.title
                        }
                        onClick={() => setSelectedLessonId(les.id)}
                        className={`flex w-full items-start gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                          locked
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
                    <div className="mt-1 rounded-md border border-dashed border-[var(--border-strong)] bg-white/65 px-2.5 py-1.5">
                      {isEmployee && mod.quiz.state === 'LOCKED' ? (
                        <div className="space-y-0.5 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>{mod.quiz.title}</span>
                          </div>
                          {mod.quiz.lockedReason && (
                            <p className="text-[11px] text-amber-700">
                              {mod.quiz.lockedReason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Link
                          href={`/quizzes/${mod.quiz.id}`}
                          className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--accent)] hover:underline"
                        >
                          <span className="flex items-center gap-1.5">
                            <ClipboardCheck
                              className="h-3.5 w-3.5 shrink-0"
                              strokeWidth={1.75}
                            />
                            {mod.quiz.title}
                          </span>
                          <Badge
                            tone={
                              mod.quiz.state === 'COMPLETED'
                                ? 'success'
                                : 'accent'
                            }
                          >
                            {mod.quiz.state === 'COMPLETED'
                              ? 'Đã đạt'
                              : isEmployee
                                ? 'Làm bài'
                                : 'Xem đề'}
                          </Badge>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Open Lesson Content — Directly on the Page (No Boxed Frames) */}
      <section className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-5 py-5 sm:px-7 lg:px-9 space-y-4">
          {quizUnlockPromptId && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-3">
              <div className="text-sm text-[var(--accent-text)]">
                <strong>Chúc mừng!</strong> Bạn đã hoàn thành toàn bộ bài giảng
                bắt buộc trong học phần và mở khóa bài kiểm tra đánh giá.
              </div>
              <Link href={`/quizzes/${quizUnlockPromptId}`}>
                <Button size="sm">Làm bài kiểm tra ngay →</Button>
              </Link>
            </div>
          )}

          {loadingLesson ? (
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
              {(isEmployee || prevLesson || nextLesson) && (
                <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-default)] pt-4 sm:grid-cols-3 sm:items-center">
                  <div className="flex justify-center sm:justify-start">
                    {prevLesson && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canOpenPrev}
                        onClick={() => setSelectedLessonId(prevLesson.id)}
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
                    {nextLesson && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!canOpenNext}
                        title={
                          !canOpenNext
                            ? 'Hoàn thành bài học hiện tại để mở bài tiếp theo'
                            : nextLesson.title
                        }
                        onClick={() => setSelectedLessonId(nextLesson.id)}
                      >
                        Bài tiếp theo
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
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
