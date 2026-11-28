'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, ClipboardPlus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  ENROLLMENT_STATUS_LABELS,
  POSITION_LABELS,
  POSITION_LEVELS,
  formatDate,
  formatDaysRemaining,
  toFutureDateInputValue,
} from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import { enrollmentsService } from '@/services/enrollments.service';
import { learningPathsService } from '@/services/learning-paths.service';
import { usersService } from '@/services/users.service';
import type {
  CourseSummary,
  EnrollmentItem,
  EnrollmentStatus,
  LearningPathSummary,
  PaginatedResponse,
  PositionLevel,
  UserSummary,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  ProgressBar,
  Select,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { DataTable, type TableColumn } from '@/components/ui/data-table';

type AssignMode = 'COURSE' | 'PATH';
type RecipientMode = 'SINGLE' | 'MULTI' | 'DEPARTMENT' | 'POSITION';

export default function EnrollmentsManagementPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const canAssignPath = user?.role === 'HR' || user?.role === 'ADMIN';
  const canDelete = user?.role === 'HR' || user?.role === 'ADMIN';

  const [list, setList] = useState<PaginatedResponse<EnrollmentItem> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'' | 'COURSE' | 'PATH'>('');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | ''>('');
  const [deptFilter, setDeptFilter] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Assignment Wizard Modal state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [assignMode, setAssignMode] = useState<AssignMode>('COURSE');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('SINGLE');
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [employees, setEmployees] = useState<UserSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedPathId, setSelectedPathId] = useState('');
  const [singleUserId, setSingleUserId] = useState('');
  const [multiUserIds, setMultiUserIds] = useState<string[]>([]);
  const [targetDept, setTargetDept] = useState('');
  const [targetPos, setTargetPos] = useState<PositionLevel>('FRESHER');
  const [deadline, setDeadline] = useState(toFutureDateInputValue(30));
  const [assigning, setAssigning] = useState(false);

  // Extend Deadline Modal
  const [editingEnrollment, setEditingEnrollment] =
    useState<EnrollmentItem | null>(null);
  const [newDeadline, setNewDeadline] = useState('');
  const [updatingDeadline, setUpdatingDeadline] = useState(false);

  // Cancel Enrollment
  const [deletingEnrollment, setDeletingEnrollment] =
    useState<EnrollmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await enrollmentsService.getAll({
        page,
        limit: 15,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        department: deptFilter.trim() || undefined,
        overdue: onlyOverdue ? true : undefined,
      });
      setList(res);
    } catch (err) {
      showError(
        'Không thể tải danh sách ghi danh',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, deptFilter, onlyOverdue, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchEnrollments();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchEnrollments]);

  const openWizard = async () => {
    setAssignMode('COURSE');
    setRecipientMode('SINGLE');
    setMultiUserIds([]);
    setDeadline(toFutureDateInputValue(30));
    setWizardOpen(true);

    try {
      const [coursesRes, usersRes, pathsRes] = await Promise.all([
        coursesService.getAll({
          limit: 100,
          isPublished: user?.role === 'ADMIN' ? '' : true,
        }),
        usersService.getAll({ page: 1, limit: 100, role: 'EMPLOYEE' }),
        canAssignPath
          ? learningPathsService.getAll()
          : Promise.resolve([] as LearningPathSummary[]),
      ]);
      setCourses(coursesRes.data ?? []);
      setSelectedCourseId(coursesRes.data?.[0]?.id ?? '');
      setEmployees(usersRes.data ?? []);
      setSingleUserId(usersRes.data?.[0]?.id ?? '');
      setPaths(pathsRes);
      setSelectedPathId(pathsRes?.[0]?.id ?? '');
    } catch {
      // handled gracefully if empty
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    try {
      const targetFields =
        recipientMode === 'SINGLE'
          ? { userId: singleUserId }
          : recipientMode === 'MULTI'
            ? { userIds: multiUserIds }
            : recipientMode === 'DEPARTMENT'
              ? { department: targetDept.trim() }
              : assignMode === 'COURSE'
                ? { position: targetPos }
                : { targetPosition: targetPos };

      const res =
        assignMode === 'COURSE'
          ? await enrollmentsService.assignCourse({
            courseId: selectedCourseId,
            deadline,
            ...targetFields,
          })
          : await enrollmentsService.assignPath({
            pathId: selectedPathId,
            deadline,
            ...targetFields,
          });

      success(
        `Đã giao bài thành công cho ${res.createdCount} học viên`,
        res.skippedCount > 0
          ? `Đã bỏ qua ${res.skippedCount} nhân sự do đã được ghi danh trước đó.`
          : undefined,
      );
      setWizardOpen(false);
      await fetchEnrollments();
    } catch (err) {
      showError(
        'Giao bài thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setAssigning(false);
    }
  };

  const handleSaveDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnrollment || !newDeadline) return;
    setUpdatingDeadline(true);
    try {
      await enrollmentsService.updateDeadline(
        editingEnrollment.id,
        newDeadline,
      );
      success('Đã gia hạn thời gian hoàn thành.');
      setEditingEnrollment(null);
      await fetchEnrollments();
    } catch (err) {
      showError(
        'Không thể cập nhật hạn chót',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setUpdatingDeadline(false);
    }
  };

  const handleDeleteEnrollment = async () => {
    if (!deletingEnrollment) return;
    setDeleting(true);
    try {
      await enrollmentsService.remove(deletingEnrollment.id);
      success('Đã hủy bản ghi giao bài.');
      setDeletingEnrollment(null);
      await fetchEnrollments();
    } catch (err) {
      showError(
        'Không thể hủy ghi danh',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<EnrollmentItem>[] = [
    {
      key: 'learner',
      header: 'Học viên',
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--text-primary)]">
            {row.user?.fullName || row.userId}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {row.user?.email} · {row.user?.department || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'Chương trình được giao',
      render: (row) => {
        const title =
          row.target?.title ||
          row.course?.title ||
          row.learningPath?.title ||
          '—';
        const code =
          row.target?.code || row.course?.code || row.learningPath?.code;
        return (
          <div>
            <div className="flex items-center gap-1.5">
              <Badge tone={row.type === 'PATH' ? 'accent' : 'info'}>
                {row.type === 'PATH' ? 'Lộ trình' : 'Khóa học lẻ'}
              </Badge>
              {code && (
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  {code}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">
              {title}
            </p>
          </div>
        );
      },
    },
    {
      key: 'progress',
      header: 'Tiến độ',
      className: 'w-44',
      render: (row) => (
        <ProgressBar
          value={row.progressPercentage}
          size="sm"
          showLabel
          tone={row.status === 'COMPLETED' ? 'success' : 'accent'}
        />
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (row) => (
        <Badge
          tone={
            row.status === 'COMPLETED'
              ? 'success'
              : row.status === 'OVERDUE'
                ? 'danger'
                : 'info'
          }
        >
          {ENROLLMENT_STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: 'deadline',
      header: 'Hạn hoàn thành',
      align: 'right',
      render: (row) => {
        const due = formatDaysRemaining(row.deadline);
        return (
          <div>
            <p className="text-xs font-medium tabular-nums">
              {formatDate(row.deadline)}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">{due.text}</p>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditingEnrollment(row);
              setNewDeadline(toFutureDateInputValue(14));
            }}
          >
            <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Gia hạn
          </Button>
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeletingEnrollment(row)}
              title="Hủy ghi danh"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-700" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giao bài & Quản lý Ghi danh"
        description={
          canAssignPath
            ? 'Phân công Lộ trình đào tạo theo cấp bậc hoặc Khóa học lẻ cho cá nhân, nhóm, phòng ban và quản lý thời hạn hoàn thành.'
            : 'Phân công Khóa học chuyên đề cho học viên và quản lý thời hạn hoàn thành các lượt giao của bạn.'
        }
        action={
          <Button
            onClick={openWizard}
            leftIcon={<ClipboardPlus className="h-4 w-4" strokeWidth={1.75} />}
          >
            Giao bài đào tạo
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 items-center">
        <Select
          value={typeFilter}
          onChange={(e) => {
            setPage(1);
            setTypeFilter(e.target.value as '' | 'COURSE' | 'PATH');
          }}
          options={[
            { value: '', label: 'Tất cả loại hình' },
            { value: 'PATH', label: 'Lộ trình (PATH)' },
            { value: 'COURSE', label: 'Khóa học lẻ (COURSE)' },
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as EnrollmentStatus | '');
          }}
          options={[
            { value: '', label: 'Mọi trạng thái' },
            { value: 'IN_PROGRESS', label: 'Đang theo học' },
            { value: 'COMPLETED', label: 'Đã hoàn thành' },
            { value: 'OVERDUE', label: 'Quá hạn' },
          ]}
        />
        <Input
          placeholder="Lọc theo phòng ban..."
          value={deptFilter}
          onChange={(e) => {
            setPage(1);
            setDeptFilter(e.target.value);
          }}
        />
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)] cursor-pointer lg:col-span-2">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => {
              setPage(1);
              setOnlyOverdue(e.target.checked);
            }}
            className="accent-[var(--accent)]"
          />
          Chỉ hiển thị học viên đang quá hạn hoàn thành
        </label>
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
        emptyTitle="Chưa có bản ghi giao bài nào"
        emptyDescription="Sử dụng nút Giao bài đào tạo ở góc trên bên phải để gán lộ trình hoặc khóa học cho nhân sự."
      />

      {/* Assignment Wizard Modal */}
      <Modal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Phân công chương trình đào tạo"
        subtitle="Hệ thống tự động bỏ qua những nhân sự đã được giao trùng trước đó."
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setWizardOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleAssignSubmit} loading={assigning}>
              Xác nhận giao bài
            </Button>
          </>
        }
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          {canAssignPath && (
            <div className="grid grid-cols-2 gap-2 rounded-md bg-[var(--bg-subtle)] p-1">
              <button
                type="button"
                onClick={() => setAssignMode('COURSE')}
                className={`rounded py-2 text-xs font-semibold cursor-pointer ${assignMode === 'COURSE'
                    ? 'bg-white text-[var(--accent)] border border-[var(--border-default)]'
                    : 'text-[var(--text-secondary)]'
                  }`}
              >
                Giao Khóa học lẻ
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('PATH')}
                className={`rounded py-2 text-xs font-semibold cursor-pointer ${assignMode === 'PATH'
                    ? 'bg-white text-[var(--accent)] border border-[var(--border-default)]'
                    : 'text-[var(--text-secondary)]'
                  }`}
              >
                Giao Lộ trình
              </button>
            </div>
          )}

          {assignMode === 'COURSE' ? (
            <Select
              label="Chọn Khóa học cần giao *"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              options={courses.map((c) => ({
                value: c.id,
                label: `[${c.code}] ${c.title}`,
              }))}
            />
          ) : (
            <Select
              label="Chọn Lộ trình đào tạo *"
              value={selectedPathId}
              onChange={(e) => setSelectedPathId(e.target.value)}
              options={paths.map((p) => ({
                value: p.id,
                label: `[${p.targetPosition}] ${p.title}`,
              }))}
            />
          )}

          <Select
            label="Phương thức chọn đối tượng nhận bài"
            value={recipientMode}
            onChange={(e) => setRecipientMode(e.target.value as RecipientMode)}
            options={[
              { value: 'SINGLE', label: '1 Nhân viên cụ thể' },
              { value: 'MULTI', label: 'Danh sách nhiều nhân viên' },
              { value: 'DEPARTMENT', label: 'Toàn bộ nhân viên thuộc Phòng ban' },
              { value: 'POSITION', label: 'Toàn bộ nhân viên theo Cấp bậc vị trí' },
            ]}
          />

          {recipientMode === 'SINGLE' && (
            <Select
              label="Nhân viên nhận bài *"
              value={singleUserId}
              onChange={(e) => setSingleUserId(e.target.value)}
              options={employees.map((u) => ({
                value: u.id,
                label: `${u.fullName} (${u.email} · ${u.position})`,
              }))}
            />
          )}

          {recipientMode === 'MULTI' && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Chọn nhân viên ({multiUserIds.length} đã chọn):
              </p>
              <div className="max-h-44 divide-y divide-[var(--border-default)] overflow-y-auto rounded-md border border-[var(--border-default)]">
                {employees.map((u) => {
                  const checked = multiUserIds.includes(u.id);
                  return (
                    <label
                      key={u.id}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--bg-subtle)] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setMultiUserIds((prev) =>
                            e.target.checked
                              ? [...prev, u.id]
                              : prev.filter((id) => id !== u.id),
                          )
                        }
                        className="accent-[var(--accent)]"
                      />
                      <span className="font-medium">{u.fullName}</span>
                      <span className="text-[var(--text-muted)]">
                        ({u.email})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {recipientMode === 'DEPARTMENT' && (
            <Input
              label="Tên phòng ban nhận bài *"
              placeholder="VD: Engineering / Backend Division"
              value={targetDept}
              onChange={(e) => setTargetDept(e.target.value)}
              required
            />
          )}

          {recipientMode === 'POSITION' && (
            <Select
              label="Cấp bậc vị trí nhận bài *"
              value={targetPos}
              onChange={(e) => setTargetPos(e.target.value as PositionLevel)}
              options={POSITION_LEVELS.map((lvl) => ({
                value: lvl,
                label: POSITION_LABELS[lvl],
              }))}
            />
          )}

          <Input
            label="Hạn chót hoàn thành (Deadline) *"
            type="date"
            required
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </form>
      </Modal>

      {/* Extend Deadline Modal */}
      <Modal
        open={Boolean(editingEnrollment)}
        onClose={() => setEditingEnrollment(null)}
        title="Gia hạn hạn chót hoàn thành"
        subtitle={`Học viên: ${editingEnrollment?.user?.fullName || ''}`}
        maxWidth="max-w-sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditingEnrollment(null)}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveDeadline} loading={updatingDeadline}>
              Lưu hạn mới
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveDeadline} className="space-y-3">
          <Input
            label="Ngày hạn chót mới (phải ở tương lai) *"
            type="date"
            required
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingEnrollment)}
        onClose={() => setDeletingEnrollment(null)}
        onConfirm={handleDeleteEnrollment}
        loading={deleting}
        title="Hủy ghi danh chương trình này?"
        description="Bản ghi giao bài sẽ bị gỡ bỏ, nhưng lịch sử hoàn thành bài giảng và kết quả Quiz trước đó của học viên vẫn được bảo toàn."
        confirmLabel="Hủy ghi danh"
      />
    </div>
  );
}
