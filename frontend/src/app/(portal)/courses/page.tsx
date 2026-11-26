'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import type { CourseSummary, PaginatedResponse } from '@/types/api.types';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { DataTable, type TableColumn } from '@/components/ui/data-table';

const SUGGESTED_COURSE_SKILLS = [
  'Java Core & OOP',
  'Spring Boot & REST API',
  'PostgreSQL & SQL',
  'Git & CI/CD',
  'System Architecture',
  'Frontend & TypeScript',
];

export default function CoursesManagementPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const router = useRouter();

  const [list, setList] = useState<PaginatedResponse<CourseSummary> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>(
    '',
  );
  const [onlyMine, setOnlyMine] = useState(false);

  // Create Course Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [skillName, setSkillName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [creating, setCreating] = useState(false);

  const [deletingCourse, setDeletingCourse] = useState<CourseSummary | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'TRAINER';

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coursesService.getAll({
        page,
        limit: 12,
        search: search.trim() || undefined,
        isPublished:
          publishedFilter === '' ? '' : publishedFilter === 'true',
        mine: onlyMine || undefined,
      });
      setList(res);
    } catch (err) {
      showError(
        'Không thể tải danh sách khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, publishedFilter, onlyMine, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchCourses();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchCourses]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) {
      showError('Vui lòng nhập đầy đủ Mã khóa học và Tiêu đề.');
      return;
    }
    setCreating(true);
    try {
      const created = await coursesService.create({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        skillName: skillName.trim() || undefined,
        description: description.trim() || undefined,
        estimatedHours: Number(estimatedHours) || 0,
      });
      success(
        `Đã tạo khóa học ${created.code}`,
        'Đang chuyển sang Studio để thêm Học phần, Bài giảng và Đề thi Quiz.',
      );
      setCreateOpen(false);
      router.push(`/courses/${created.id}/builder`);
    } catch (err) {
      showError(
        'Không thể tạo khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setCreating(false);
    }
  };

  const handleTogglePublish = async (course: CourseSummary) => {
    try {
      await coursesService.setPublished(course.id, !course.isPublished);
      success(
        !course.isPublished
          ? `Đã xuất bản khóa học ${course.code}`
          : `Đã gỡ xuất bản khóa học ${course.code}`,
      );
      await fetchCourses();
    } catch (err) {
      showError(
        'Thao tác xuất bản thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCourse) return;
    setDeleting(true);
    try {
      await coursesService.remove(deletingCourse.id);
      success(`Đã xóa khóa học ${deletingCourse.code}`);
      setDeletingCourse(null);
      await fetchCourses();
    } catch (err) {
      showError(
        'Không thể xóa khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<CourseSummary>[] = [
    {
      key: 'code',
      header: 'Mã khóa',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-[var(--accent)]">
          {row.code}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Tên khóa học & Kỹ năng',
      render: (row) => (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[var(--text-primary)]">{row.title}</p>
            {row.skillName && (
              <Badge tone="info">{row.skillName}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-1">
            Giảng viên: {row.createdBy?.fullName || 'Hệ thống'} ·{' '}
            {row.estimatedHours} giờ
          </p>
        </div>
      ),
    },
    {
      key: 'structure',
      header: 'Học phần / Học viên',
      align: 'center',
      render: (row) => (
        <span className="text-xs text-[var(--text-secondary)] tabular-nums">
          {row._count?.modules ?? 0} học phần ·{' '}
          {row._count?.courseEnrollments ?? 0} lượt giao lẻ
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (row) =>
        row.isPublished ? (
          <Badge tone="success">Đã xuất bản</Badge>
        ) : (
          <Badge tone="warning">Bản nháp</Badge>
        ),
    },
    {
      key: 'createdAt',
      header: 'Ngày tạo',
      align: 'right',
      render: (row) => (
        <span className="text-xs text-[var(--text-secondary)]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (row) => {
        const isOwnerOrAdmin =
          user?.role === 'ADMIN' ||
          (user?.role === 'TRAINER' && row.createdById === user.id);
        return (
          <div className="inline-flex items-center justify-end gap-1.5">
            <Link href={`/courses/${row.id}`}>
              <Button size="sm" variant="ghost" title="Xem phòng học">
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Button>
            </Link>
            {isOwnerOrAdmin && (
              <>
                <Link href={`/courses/${row.id}/builder`}>
                  <Button size="sm" variant="secondary">
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Studio & Quiz
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleTogglePublish(row)}
                >
                  {row.isPublished ? 'Hủy publish' : 'Publish'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeletingCourse(row)}
                  title="Xóa khóa học"
                >
                  <Trash2
                    className="h-3.5 w-3.5 text-rose-700"
                    strokeWidth={1.75}
                  />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kho khóa học & Học liệu"
        description="Quản lý danh mục khóa học, biên soạn học phần, bài giảng đa định dạng và ngân hàng câu hỏi kiểm tra trắc nghiệm."
        action={
          canCreate ? (
            <Button
              onClick={() => {
                setCode('');
                setTitle('');
                setSkillName('');
                setDescription('');
                setEstimatedHours('8');
                setCreateOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Tạo khóa học mới
            </Button>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              type="text"
              placeholder="Tìm theo mã khóa học hoặc tiêu đề..."
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              className="h-9.5 w-full rounded-md border border-[var(--border-default)] pl-9 pr-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="w-44">
            <Select
              value={publishedFilter}
              onChange={(e) => {
                setPage(1);
                setPublishedFilter(e.target.value as '' | 'true' | 'false');
              }}
              options={[
                { value: '', label: 'Mọi trạng thái' },
                { value: 'true', label: 'Đã xuất bản' },
                { value: 'false', label: 'Bản nháp' },
              ]}
            />
          </div>

          {user?.role === 'TRAINER' && (
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => {
                  setPage(1);
                  setOnlyMine(e.target.checked);
                }}
                className="accent-[var(--accent)]"
              />
              Chỉ khóa học tôi tạo
            </label>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={list?.data ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        page={list?.page}
        totalPages={list?.totalPages}
        total={list?.total}
        onPageChange={setPage}
        emptyTitle="Chưa có khóa học nào phù hợp"
        emptyDescription="Tạo khóa học mới để bắt đầu biên soạn nội dung giảng dạy và câu hỏi kiểm tra."
      />

      {/* Create Course Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Khởi tạo khóa học mới"
        subtitle="Khóa học mới được tạo ở trạng thái Bản nháp để bạn thoải mái thêm học phần và bài học."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateCourse} loading={creating}>
              Tạo & Mở Studio
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateCourse} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Mã khóa học *"
              placeholder="VD: JAVA_CORE_01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              hint="Chữ in hoa, số, _ hoặc -"
              required
            />
            <div className="sm:col-span-2">
              <Input
                label="Tên khóa học *"
                placeholder="VD: Nền tảng Lập trình Java Doanh nghiệp"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Input
                label="Kỹ năng đánh giá (Ma trận năng lực)"
                placeholder="VD: Java Core & OOP"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_COURSE_SKILLS.map((sk) => (
                  <button
                    key={sk}
                    type="button"
                    onClick={() => setSkillName(sk)}
                    className="rounded border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:border-[var(--accent)] cursor-pointer"
                  >
                    {sk}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Thời lượng ước tính (giờ)"
              type="number"
              min={0}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
            />
          </div>
          <Textarea
            label="Mô tả mục tiêu khóa học"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingCourse)}
        onClose={() => setDeletingCourse(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
        title={`Xóa khóa học ${deletingCourse?.code}?`}
        description="Khóa học sẽ được chuyển sang trạng thái xóa mềm (ẩn khỏi danh mục). Với giảng viên, hệ thống sẽ từ chối nếu khóa học đang nằm trong lộ trình hoặc có học viên đang theo học."
        confirmLabel="Xóa khóa học"
      />
    </div>
  );
}
