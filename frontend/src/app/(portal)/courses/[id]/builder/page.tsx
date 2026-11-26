'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { CONTENT_TYPE_LABELS, formatFileSize } from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import type {
  ContentType,
  CourseDetail,
  LessonItem,
  ModuleItem,
  UploadedFileMeta,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { QuizManagerPanel } from '@/components/features/quiz-manager-panel';

export default function CourseBuilderStudioPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Course General Info form
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('0');
  const [savingCourse, setSavingCourse] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Module Modal
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleItem | null>(null);
  const [modTitle, setModTitle] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [dayStart, setDayStart] = useState('');
  const [dayEnd, setDayEnd] = useState('');
  const [savingModule, setSavingModule] = useState(false);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<
    Record<string, boolean>
  >({});

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModuleIds((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Lesson Modal
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [editingLesson, setEditingLesson] = useState<LessonItem | null>(null);
  const [lesTitle, setLesTitle] = useState('');
  const [lesType, setLesType] = useState<ContentType>('VIDEO');
  const [lesUrl, setLesUrl] = useState('');
  const [lesText, setLesText] = useState('');
  const [lesDuration, setLesDuration] = useState('15');
  const [lesRequired, setLesRequired] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileMeta | null>(
    null,
  );
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  const loadCourse = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await coursesService.getById(params.id);
      setCourse(detail);
      setCode(detail.code);
      setTitle(detail.title);
      setDescription(detail.description || '');
      setEstimatedHours(String(detail.estimatedHours ?? 0));
    } catch (err) {
      showError(
        'Không thể tải dữ liệu Studio khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadCourse();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadCourse]);

  const handleSaveCourseInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course) return;
    setSavingCourse(true);
    try {
      await coursesService.update(course.id, {
        code: code.trim().toUpperCase(),
        title: title.trim(),
        description: description.trim(),
        estimatedHours: Number(estimatedHours) || 0,
      });
      await loadCourse();
      success('Đã lưu thông tin chung của khóa học.');
    } catch (err) {
      showError(
        'Lưu thông tin khóa học thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingCourse(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!course) return;
    setPublishing(true);
    try {
      await coursesService.setPublished(course.id, !course.isPublished);
      await loadCourse();
      success(
        !course.isPublished
          ? 'Khóa học đã được xuất bản chính thức!'
          : 'Đã chuyển khóa học về trạng thái Bản nháp.',
      );
    } catch (err) {
      showError(
        'Không thể đổi trạng thái xuất bản',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setPublishing(false);
    }
  };

  // Module CRUD & Reorder
  const openCreateModule = () => {
    setEditingModule(null);
    setModTitle('');
    setModDesc('');
    setDayStart('');
    setDayEnd('');
    setModuleModalOpen(true);
  };

  const openEditModule = (mod: ModuleItem) => {
    setEditingModule(mod);
    setModTitle(mod.title);
    setModDesc(mod.description || '');
    setDayStart(mod.dayStart ? String(mod.dayStart) : '');
    setDayEnd(mod.dayEnd ? String(mod.dayEnd) : '');
    setModuleModalOpen(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!course || !modTitle.trim()) return;
    setSavingModule(true);
    try {
      if (editingModule) {
        await coursesService.updateModule(editingModule.id, {
          title: modTitle.trim(),
          description: modDesc.trim(),
          dayStart: dayStart ? Number(dayStart) : null,
          dayEnd: dayEnd ? Number(dayEnd) : null,
        });
        success('Đã cập nhật học phần.');
      } else {
        await coursesService.createModule(course.id, {
          title: modTitle.trim(),
          description: modDesc.trim() || undefined,
          dayStart: dayStart ? Number(dayStart) : undefined,
          dayEnd: dayEnd ? Number(dayEnd) : undefined,
        });
        success('Đã thêm học phần mới.');
      }
      setModuleModalOpen(false);
      await loadCourse();
    } catch (err) {
      showError(
        'Không thể lưu học phần',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingModule(false);
    }
  };

  const handleMoveModule = async (index: number, direction: -1 | 1) => {
    if (!course) return;
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= course.modules.length) return;
    const ids = course.modules.map((m) => m.id);
    [ids[index], ids[nextIdx]] = [ids[nextIdx], ids[index]];
    try {
      await coursesService.reorderModules(course.id, ids);
      await loadCourse();
      success('Đã cập nhật thứ tự học phần.');
    } catch (err) {
      showError(
        'Không thể đổi thứ tự học phần',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleDeleteModule = async () => {
    if (!deletingModuleId) return;
    try {
      await coursesService.removeModule(deletingModuleId);
      setDeletingModuleId(null);
      await loadCourse();
      success('Đã xóa học phần.');
    } catch (err) {
      showError(
        'Không thể xóa học phần',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  // Lesson CRUD, PDF Upload & Reorder
  const openCreateLesson = (moduleId: string) => {
    setTargetModuleId(moduleId);
    setEditingLesson(null);
    setLesTitle('');
    setLesType('VIDEO');
    setLesUrl('');
    setLesText('');
    setLesDuration('15');
    setLesRequired(true);
    setUploadedFile(null);
    setLessonModalOpen(true);
  };

  const openEditLesson = (lesson: LessonItem) => {
    setTargetModuleId(lesson.moduleId);
    setEditingLesson(lesson);
    setLesTitle(lesson.title);
    setLesType(lesson.contentType);
    setLesUrl(lesson.contentUrl || '');
    setLesText(lesson.contentText || '');
    setLesDuration(String(lesson.durationMinutes ?? 15));
    setLesRequired(lesson.isRequired !== false);
    setUploadedFile(lesson.file ?? null);
    setLessonModalOpen(true);
  };

  const handleUploadPdfFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      showError('Dung lượng tệp PDF vượt quá giới hạn tối đa 20MB.');
      return;
    }
    setUploadingPdf(true);
    try {
      const meta = await coursesService.uploadPdf(file);
      setUploadedFile(meta);
      setLesUrl(meta.url);
      success(`Đã tải lên tệp "${meta.originalName}".`);
    } catch (err) {
      showError(
        'Tải tệp PDF thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleId || !lesTitle.trim()) return;

    setSavingLesson(true);
    try {
      const payload = {
        title: lesTitle.trim(),
        contentType: lesType,
        durationMinutes: Number(lesDuration) || 0,
        isRequired: lesRequired,
        ...(lesType === 'VIDEO'
          ? { contentUrl: lesUrl.trim(), contentText: lesText.trim() || undefined }
          : lesType === 'PDF'
            ? {
                fileId: uploadedFile?.id || editingLesson?.fileId || undefined,
                contentUrl: uploadedFile?.url || lesUrl.trim() || undefined,
              }
            : { contentText: lesText.trim() }),
      };

      if (editingLesson) {
        await coursesService.updateLesson(editingLesson.id, payload);
        success('Đã cập nhật bài giảng.');
      } else {
        await coursesService.createLesson(targetModuleId, payload);
        success('Đã thêm bài giảng mới.');
      }
      setLessonModalOpen(false);
      await loadCourse();
    } catch (err) {
      showError(
        'Lưu bài giảng thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingLesson(false);
    }
  };

  const handleMoveLesson = async (
    mod: ModuleItem,
    index: number,
    direction: -1 | 1,
  ) => {
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= mod.lessons.length) return;
    const ids = mod.lessons.map((l) => l.id);
    [ids[index], ids[nextIdx]] = [ids[nextIdx], ids[index]];
    try {
      await coursesService.reorderLessons(mod.id, ids);
      await loadCourse();
      success('Đã cập nhật thứ tự bài giảng.');
    } catch (err) {
      showError(
        'Không thể đổi thứ tự bài giảng',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleDeleteLesson = async () => {
    if (!deletingLessonId) return;
    try {
      await coursesService.removeLesson(deletingLessonId);
      setDeletingLessonId(null);
      await loadCourse();
      success('Đã xóa bài giảng.');
    } catch (err) {
      showError(
        'Không thể xóa bài giảng',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        title="Không tìm thấy khóa học"
        action={
          <Link href="/courses">
            <Button variant="secondary">Về danh sách khóa học</Button>
          </Link>
        }
      />
    );
  }

  const codeLockedForTrainer =
    !isAdmin && (course._count?.courseEnrollments ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Quay về Kho khóa học
      </Link>

      <PageHeader
        title={`Studio Biên soạn: ${course.title}`}
        description="Thiết kế cấu trúc Học phần, tải lên Bài giảng PDF / Video / Markdown và quản lý Ngân hàng câu hỏi trắc nghiệm Quiz."
        badge={
          course.isPublished ? (
            <Badge tone="success">Đang xuất bản</Badge>
          ) : (
            <Badge tone="warning">Bản nháp</Badge>
          )
        }
        secondaryAction={
          <Link href={`/courses/${course.id}`}>
            <Button
              variant="secondary"
              leftIcon={<Eye className="h-4 w-4" strokeWidth={1.75} />}
            >
              Xem Phòng học
            </Button>
          </Link>
        }
        action={
          <Button
            onClick={handleTogglePublish}
            loading={publishing}
            variant={course.isPublished ? 'secondary' : 'primary'}
          >
            {course.isPublished ? 'Chuyển về Bản nháp' : 'Xuất bản khóa học'}
          </Button>
        }
      />

      {/* General Course Metadata */}
      <Card
        title="Thông tin chung của khóa học"
        subtitle={
          isAdmin
            ? 'Tài khoản ADMIN có toàn quyền chỉnh sửa mọi thông tin và cấu trúc khóa học.'
            : 'Cập nhật tiêu đề, mô tả và thời lượng ước tính.'
        }
      >
        <form onSubmit={handleSaveCourseInfo} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Input
              label="Mã khóa học"
              value={code}
              disabled={codeLockedForTrainer}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <div className="sm:col-span-2">
              <Input
                label="Tiêu đề khóa học"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <Input
              label="Thời lượng (giờ)"
              type="number"
              min={0}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
          <Textarea
            label="Mô tả khóa học"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="secondary"
              loading={savingCourse}
              leftIcon={<Save className="h-4 w-4" strokeWidth={1.75} />}
            >
              Lưu thông tin chung
            </Button>
          </div>
        </form>
      </Card>

      {/* Curriculum Modules + Lessons + Quiz Studio */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--accent)]" strokeWidth={1.75} />
            Cấu trúc Học phần, Bài giảng & Đề thi ({course.modules.length} học
            phần)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {course.modules.length > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const allCollapsed = course.modules.every(
                    (m) => collapsedModuleIds[m.id],
                  );
                  if (allCollapsed) {
                    setCollapsedModuleIds({});
                  } else {
                    setCollapsedModuleIds(
                      Object.fromEntries(
                        course.modules.map((m) => [m.id, true]),
                      ),
                    );
                  }
                }}
              >
                {course.modules.every((m) => collapsedModuleIds[m.id])
                  ? 'Mở rộng tất cả'
                  : 'Thu gọn tất cả'}
              </Button>
            )}
            <Button
              onClick={openCreateModule}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Thêm Học phần (Module)
            </Button>
          </div>
        </div>

        {course.modules.length === 0 ? (
          <EmptyState
            title="Khóa học chưa có học phần nào"
            description="Cần ít nhất 1 học phần và 1 bài học trước khi có thể xuất bản khóa học."
            action={
              <Button onClick={openCreateModule}>Tạo Học phần đầu tiên</Button>
            }
          />
        ) : (
          course.modules.map((mod, modIdx) => {
            const isCollapsed = Boolean(collapsedModuleIds[mod.id]);
            return (
              <section
                key={mod.id}
                className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)]"
              >
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
                    !isCollapsed
                      ? 'border-b border-[var(--border-default)]'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleModuleCollapse(mod.id)}
                    className="flex min-w-0 flex-1 items-start gap-2.5 text-left cursor-pointer group"
                    title={
                      isCollapsed ? 'Mở rộng học phần' : 'Thu gọn học phần'
                    }
                  >
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-secondary)] group-hover:bg-[var(--bg-subtle)] group-hover:text-[var(--text-primary)]">
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
                      ) : (
                        <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[17px] font-semibold text-[var(--text-primary)] leading-snug">
                          Học phần {mod.moduleOrder}: {mod.title}
                        </h3>
                        <Badge tone="neutral">
                          {mod.lessons.length} bài giảng
                          {mod.quiz ? ' · Có Quiz' : ''}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                        {mod.description ||
                          (mod.dayStart && mod.dayEnd
                            ? `Mốc gợi ý Onboarding: Ngày ${mod.dayStart} – Ngày ${mod.dayEnd}`
                            : 'Danh sách bài giảng và đề kiểm tra của học phần')}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleModuleCollapse(mod.id)}
                    >
                      {isCollapsed ? 'Mở rộng' : 'Thu gọn'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={modIdx === 0}
                      onClick={() => handleMoveModule(modIdx, -1)}
                      title="Đẩy học phần lên trên"
                    >
                      <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={modIdx === course.modules.length - 1}
                      onClick={() => handleMoveModule(modIdx, 1)}
                      title="Đẩy học phần xuống dưới"
                    >
                      <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditModule(mod)}
                    >
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeletingModuleId(mod.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="p-5 space-y-4">
                    {/* Lessons inside Module */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Bài giảng trong học phần ({mod.lessons.length})
                        </p>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openCreateLesson(mod.id)}
                          leftIcon={
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                          }
                        >
                          Thêm bài giảng
                        </Button>
                      </div>

                      {mod.lessons.length === 0 ? (
                        <p className="rounded-md border border-dashed border-[var(--border-default)] py-5 text-center text-xs text-[var(--text-muted)]">
                          Chưa có bài giảng nào trong học phần này.
                        </p>
                      ) : (
                        <div className="divide-y divide-[var(--border-default)] rounded-md border border-[var(--border-default)]">
                          {mod.lessons.map((les, lesIdx) => (
                            <div
                              key={les.id}
                              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)]/50"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {les.contentType === 'VIDEO' ? (
                                  <Video
                                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                                    strokeWidth={1.75}
                                  />
                                ) : (
                                  <FileText
                                    className="h-4 w-4 shrink-0 text-[var(--accent)]"
                                    strokeWidth={1.75}
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                                    Bài {les.lessonOrder}: {les.title}
                                  </p>
                                  <p className="text-xs text-[var(--text-muted)]">
                                    {CONTENT_TYPE_LABELS[les.contentType]} ·{' '}
                                    {les.durationMinutes} phút ·{' '}
                                    {les.isRequired
                                      ? 'Bắt buộc (BR-02)'
                                      : 'Tham khảo'}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={lesIdx === 0}
                                  onClick={() =>
                                    handleMoveLesson(mod, lesIdx, -1)
                                  }
                                >
                                  <ArrowUp
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={lesIdx === mod.lessons.length - 1}
                                  onClick={() =>
                                    handleMoveLesson(mod, lesIdx, 1)
                                  }
                                >
                                  <ArrowDown
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditLesson(les)}
                                >
                                  <Pencil
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.75}
                                  />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeletingLessonId(les.id)}
                                >
                                  <Trash2
                                    className="h-3.5 w-3.5 text-rose-700"
                                    strokeWidth={1.75}
                                  />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Integrated Quiz & Multiple-Choice Question Authoring Panel */}
                    <QuizManagerPanel
                      moduleId={mod.id}
                      initialQuiz={mod.quiz}
                      onChanged={loadCourse}
                    />
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Module Modal */}
      <Modal
        open={moduleModalOpen}
        onClose={() => setModuleModalOpen(false)}
        title={editingModule ? 'Chỉnh sửa Học phần' : 'Thêm Học phần mới'}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setModuleModalOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveModule} loading={savingModule}>
              Lưu học phần
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveModule} className="space-y-4">
          <Input
            label="Tên học phần *"
            required
            placeholder="VD: Kiến trúc RESTful & Bảo mật JWT"
            value={modTitle}
            onChange={(e) => setModTitle(e.target.value)}
          />
          <Textarea
            label="Mô tả ngắn"
            rows={2}
            value={modDesc}
            onChange={(e) => setModDesc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Từ ngày Onboarding (tùy chọn)"
              type="number"
              min={1}
              value={dayStart}
              onChange={(e) => setDayStart(e.target.value)}
            />
            <Input
              label="Đến ngày Onboarding (tùy chọn)"
              type="number"
              min={1}
              value={dayEnd}
              onChange={(e) => setDayEnd(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Lesson Modal (VIDEO / PDF / MARKDOWN) */}
      <Modal
        open={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        title={editingLesson ? 'Chỉnh sửa Bài giảng' : 'Thêm Bài giảng mới'}
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setLessonModalOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveLesson} loading={savingLesson}>
              Lưu bài giảng
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveLesson} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Input
                label="Tiêu đề bài giảng *"
                required
                value={lesTitle}
                onChange={(e) => setLesTitle(e.target.value)}
              />
            </div>
            <Select
              label="Định dạng nội dung"
              value={lesType}
              onChange={(e) => setLesType(e.target.value as ContentType)}
              options={[
                { value: 'VIDEO', label: 'Video bài giảng (URL)' },
                { value: 'PDF', label: 'Tài liệu PDF (<= 20MB)' },
                { value: 'MARKDOWN', label: 'Bài đọc Markdown' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <Input
              label="Thời lượng học (phút)"
              type="number"
              min={0}
              value={lesDuration}
              onChange={(e) => setLesDuration(e.target.value)}
            />
            <label className="flex h-9.5 items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={lesRequired}
                onChange={(e) => setLesRequired(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              Bài học bắt buộc để mở khóa Quiz (BR-02)
            </label>
          </div>

          {lesType === 'VIDEO' && (
            <>
              <Input
                label="Đường dẫn Video (YouTube hoặc MP4 trực tiếp http/https) *"
                placeholder="https://www.youtube.com/watch?v=..."
                value={lesUrl}
                onChange={(e) => setLesUrl(e.target.value)}
                required
              />
              <Textarea
                label="Ghi chú tóm tắt đi kèm video (tùy chọn)"
                rows={3}
                value={lesText}
                onChange={(e) => setLesText(e.target.value)}
              />
            </>
          )}

          {lesType === 'PDF' && (
            <div className="space-y-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] bg-white px-4 py-6 text-center hover:border-[var(--accent)]">
                <Upload
                  className="mb-2 h-6 w-6 text-[var(--accent)]"
                  strokeWidth={1.75}
                />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {uploadingPdf
                    ? 'Đang kiểm tra chữ ký %PDF- & tải tệp lên...'
                    : 'Nhấn để chọn tệp tài liệu PDF từ máy tính'}
                </span>
                <span className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Chỉ chấp nhận tệp PDF hợp lệ, tối đa 20 MB
                </span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleUploadPdfFile}
                  className="hidden"
                />
              </label>

              {uploadedFile && (
                <p className="text-xs font-medium text-emerald-800">
                  Đã gắn tệp: {uploadedFile.originalName} (
                  {formatFileSize(uploadedFile.sizeBytes)})
                </p>
              )}

              <Input
                label="Hoặc đường dẫn tài liệu PDF"
                value={lesUrl}
                onChange={(e) => setLesUrl(e.target.value)}
                placeholder="/api/v1/files/... hoặc https://..."
              />
            </div>
          )}

          {lesType === 'MARKDOWN' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Textarea
                label="Mã nguồn Markdown *"
                rows={10}
                value={lesText}
                onChange={(e) => setLesText(e.target.value)}
                placeholder="# Tiêu đề bài học&#10;&#10;- Ý chính 1&#10;- Ý chính 2"
                required
              />
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--text-secondary)]">
                  Xem trước trực tiếp
                </p>
                <div className="lms-markdown h-[232px] overflow-y-auto rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]/40 p-3 text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {lesText || '_Nhập nội dung bên trái để xem trước..._'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingModuleId)}
        onClose={() => setDeletingModuleId(null)}
        onConfirm={handleDeleteModule}
        title="Xóa học phần này?"
        description="Các học phần còn lại sẽ được tự động đánh số thứ tự liên tục lại."
        confirmLabel="Xóa học phần"
      />

      <ConfirmDialog
        open={Boolean(deletingLessonId)}
        onClose={() => setDeletingLessonId(null)}
        onConfirm={handleDeleteLesson}
        title="Xóa bài giảng này?"
        description="Bài giảng sẽ được xóa mềm và sắp xếp lại thứ tự các bài còn lại trong học phần."
        confirmLabel="Xóa bài giảng"
      />
    </div>
  );
}
