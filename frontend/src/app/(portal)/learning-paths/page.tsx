'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Compass,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { POSITION_LABELS, POSITION_LEVELS } from '@/lib/formatters';
import { learningPathsService } from '@/services/learning-paths.service';
import type { LearningPathSummary, PositionLevel } from '@/types/api.types';
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

export default function LearningPathsPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const router = useRouter();

  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionLevel | ''>('');
  const [search, setSearch] = useState('');

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<LearningPathSummary | null>(
    null,
  );
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [targetPosition, setTargetPosition] =
    useState<PositionLevel>('FRESHER');
  const [estimatedDays, setEstimatedDays] = useState('30');
  const [isMandatory, setIsMandatory] = useState(true);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [archivingPath, setArchivingPath] =
    useState<LearningPathSummary | null>(null);
  const [archiving, setArchiving] = useState(false);

  const canManage = user?.role === 'HR' || user?.role === 'ADMIN';

  const fetchPaths = useCallback(async () => {
    setLoading(true);
    try {
      const res = await learningPathsService.getAll({
        targetPosition: positionFilter || undefined,
        search: search.trim() || undefined,
      });
      setPaths(Array.isArray(res) ? res : []);
    } catch (err) {
      showError(
        'Không thể tải danh sách lộ trình',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [positionFilter, search, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchPaths();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchPaths]);

  const openCreateModal = () => {
    setEditingPath(null);
    setTitle('');
    setCode('');
    setTargetPosition('FRESHER');
    setEstimatedDays('30');
    setIsMandatory(true);
    setDescription('');
    setModalOpen(true);
  };

  const openEditModal = (p: LearningPathSummary) => {
    setEditingPath(p);
    setTitle(p.title);
    setCode(p.code);
    setTargetPosition(p.targetPosition);
    setEstimatedDays(String(p.estimatedDays ?? 30));
    setIsMandatory(p.isMandatory);
    setDescription(p.description || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        targetPosition,
        estimatedDays: Number(estimatedDays) || 30,
        isMandatory,
        description: description.trim() || undefined,
        code: code.trim() || undefined,
      };

      if (editingPath) {
        await learningPathsService.update(editingPath.id, payload);
        success('Đã cập nhật thông tin lộ trình.');
        setModalOpen(false);
        await fetchPaths();
      } else {
        const created = await learningPathsService.create(payload);
        success('Đã tạo lộ trình mới.');
        setModalOpen(false);
        router.push(`/learning-paths/${created.id}`);
      }
    } catch (err) {
      showError(
        'Lưu lộ trình thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingPath) return;
    setArchiving(true);
    try {
      await learningPathsService.archive(archivingPath.id);
      success(`Đã lưu trữ lộ trình "${archivingPath.title}".`);
      setArchivingPath(null);
      await fetchPaths();
    } catch (err) {
      showError(
        'Không thể lưu trữ lộ trình',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lộ trình đào tạo 5 cấp bậc"
        description="Chuẩn hóa khung chương trình đào tạo theo từng cấp bậc nghề nghiệp (4 Học phần chuyên môn + 1 Bài kiểm tra tổng hợp cuối khóa)."
        action={
          canManage ? (
            <Button
              onClick={openCreateModal}
              leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            >
              Tạo lộ trình mới
            </Button>
          ) : undefined
        }
      />

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPositionFilter('')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
              positionFilter === ''
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Tất cả cấp bậc
          </button>
          {POSITION_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setPositionFilter(lvl)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                positionFilter === lvl
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên lộ trình..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-md border border-[var(--border-default)] pl-9 pr-3 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : paths.length === 0 ? (
        <EmptyState
          icon={<Compass className="h-5 w-5" strokeWidth={1.75} />}
          title="Chưa có lộ trình nào phù hợp"
          description="Thử xóa bộ lọc hoặc khởi tạo lộ trình mới cho vị trí tương ứng."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {paths.map((p) => {
            const structureReady =
              (p.totalUnits ?? 0) === 4 && Boolean(p.hasFinal);
            return (
              <Card key={p.id} className="flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="accent">
                      {POSITION_LABELS[p.targetPosition]}
                    </Badge>
                    <Badge tone={structureReady ? 'success' : 'warning'}>
                      {structureReady ? 'Đạt chuẩn 4+1' : 'Cần cấu hình'}
                    </Badge>
                  </div>

                  <div>
                    <p className="font-mono text-xs text-[var(--text-muted)]">
                      {p.code}
                    </p>
                    <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">
                      {p.title}
                    </h3>
                    {p.description && (
                      <p className="mt-1 text-xs text-[var(--text-secondary)] line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)]/65 p-2.5 text-center text-xs">
                    <div>
                      <p className="text-[var(--text-muted)]">Khóa học</p>
                      <p className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {p.totalCourses ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Học phần</p>
                      <p className="font-semibold text-[var(--text-primary)] tabular-nums">
                        {p.totalUnits ?? 0}/4
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--text-muted)]">Thi Final</p>
                      <p className="font-semibold text-[var(--text-primary)]">
                        {p.hasFinal ? (
                          <CheckCircle2
                            className="mx-auto h-4 w-4 text-emerald-600 mt-0.5"
                            strokeWidth={1.75}
                          />
                        ) : (
                          'Chưa có'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-3">
                    <div className="flex items-center gap-1">
                      {canManage && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(p)}
                            title="Sửa thông tin"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setArchivingPath(p)}
                            title="Lưu trữ lộ trình"
                          >
                            <Archive
                              className="h-3.5 w-3.5 text-rose-700"
                              strokeWidth={1.75}
                            />
                          </Button>
                        </>
                      )}
                    </div>

                    <Link
                      href={`/learning-paths/${p.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      {canManage ? 'Thiết kế cấu trúc' : 'Xem chi tiết'}
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Learning Path Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPath ? 'Cập nhật Lộ trình' : 'Tạo Lộ trình đào tạo mới'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingPath ? 'Lưu cập nhật' : 'Tạo & Cấu hình chặng'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Tên lộ trình *"
            required
            placeholder="VD: Lộ trình Onboarding Kỹ sư Backend Fresher"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Vị trí cấp bậc mục tiêu *"
              value={targetPosition}
              onChange={(e) =>
                setTargetPosition(e.target.value as PositionLevel)
              }
              options={POSITION_LEVELS.map((lvl) => ({
                value: lvl,
                label: POSITION_LABELS[lvl],
              }))}
            />
            <Input
              label="Thời hạn dự kiến (ngày)"
              type="number"
              min={1}
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
            />
          </div>
          <Input
            label="Mã định danh slug (để trống tự sinh)"
            placeholder="VD: path-fresher-backend"
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
          />
          <Textarea
            label="Mô tả lộ trình"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Lộ trình bắt buộc cho nhân sự thuộc cấp bậc này
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archivingPath)}
        onClose={() => setArchivingPath(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title={`Lưu trữ lộ trình "${archivingPath?.title}"?`}
        description="Lộ trình sẽ ngừng hiển thị trong danh sách giao mới. Với HR, hệ thống sẽ chặn lưu trữ nếu đang có nhân viên theo học (IN_PROGRESS)."
        confirmLabel="Lưu trữ lộ trình"
      />
    </div>
  );
}
