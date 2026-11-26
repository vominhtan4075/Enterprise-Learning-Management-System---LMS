'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { POSITION_LABELS, formatValidationIssue } from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import { learningPathsService } from '@/services/learning-paths.service';
import type {
  CourseSummary,
  LearningPathDetail,
  PathValidationResult,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

export default function LearningPathDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [path, setPath] = useState<LearningPathDetail | null>(null);
  const [validation, setValidation] = useState<PathValidationResult | null>(
    null,
  );
  const [availableCourses, setAvailableCourses] = useState<CourseSummary[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);

  const isEmployee = user?.role === 'EMPLOYEE';
  const canEditStructure = user?.role === 'HR' || user?.role === 'ADMIN';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await learningPathsService.getById(params.id);
      setPath(detail);

      if (!isEmployee) {
        const [valRes, coursesRes] = await Promise.all([
          learningPathsService.validate(detail.id).catch(() => null),
          canEditStructure
            ? coursesService
                .getAll({
                  limit: 100,
                  isPublished: user?.role === 'ADMIN' ? '' : true,
                })
                .catch(() => null)
            : Promise.resolve(null),
        ]);
        setValidation(valRes);
        if (coursesRes?.data) {
          const existingIds = new Set(
            detail.pathCourses.map((pc) => pc.courseId),
          );
          const candidates = coursesRes.data.filter(
            (c) => !existingIds.has(c.id),
          );
          setAvailableCourses(candidates);
          setSelectedCourseId(candidates[0]?.id ?? '');
        }
      }
    } catch (err) {
      showError(
        'Không thể tải chi tiết lộ trình',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [params.id, isEmployee, canEditStructure, user, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadData]);

  const handleAddCourse = async () => {
    if (!path || !selectedCourseId) return;
    setMutating(true);
    try {
      await learningPathsService.addCourse(path.id, selectedCourseId);
      success('Đã thêm khóa học vào lộ trình.');
      await loadData();
    } catch (err) {
      showError(
        'Không thể thêm khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setMutating(false);
    }
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!path) return;
    setMutating(true);
    try {
      await learningPathsService.removeCourse(path.id, courseId);
      success('Đã gỡ khóa học khỏi lộ trình.');
      await loadData();
    } catch (err) {
      showError(
        'Không thể gỡ khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setMutating(false);
    }
  };

  const handleMoveCourse = async (index: number, direction: -1 | 1) => {
    if (!path) return;
    const nextIdx = index + direction;
    if (nextIdx < 0 || nextIdx >= path.pathCourses.length) return;
    const orderedIds = path.pathCourses.map((pc) => pc.courseId);
    [orderedIds[index], orderedIds[nextIdx]] = [
      orderedIds[nextIdx],
      orderedIds[index],
    ];
    setMutating(true);
    try {
      await learningPathsService.reorderCourses(path.id, orderedIds);
      success('Đã cập nhật thứ tự các chặng trong lộ trình.');
      await loadData();
    } catch (err) {
      showError(
        'Không thể đổi thứ tự khóa học',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setMutating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-14 w-1/2" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!path) {
    return (
      <EmptyState
        title="Không tìm thấy lộ trình học tập"
        action={
          <Link href={isEmployee ? '/my-learning' : '/learning-paths'}>
            <Button variant="secondary">Quay lại</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={isEmployee ? '/my-learning' : '/learning-paths'}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        {isEmployee ? 'Học tập của tôi' : 'Danh sách lộ trình 5 cấp bậc'}
      </Link>

      <PageHeader
        title={path.title}
        description={
          path.description ||
          `Mã lộ trình: ${path.code} · Thời gian hoàn thành khuyến nghị: ${path.estimatedDays} ngày`
        }
        badge={
          <Badge tone="accent">{POSITION_LABELS[path.targetPosition]}</Badge>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Main Steps Timeline / Builder */}
        <div className="space-y-4 lg:col-span-8">
          {canEditStructure && (
            <Card
              tinted
              title="Thêm khóa học vào lộ trình"
              subtitle={
                user?.role === 'ADMIN'
                  ? 'Quyền ADMIN: Cho phép thêm/gỡ/đổi thứ tự không giới hạn số lượng khóa học bất kỳ lúc nào.'
                  : 'Thêm số lượng khóa học đã xuất bản tùy ý; chỉ cần học phần cuối lộ trình có bài kiểm tra Quiz đã xuất bản.'
              }
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label="Khóa học khả dụng"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    options={
                      availableCourses.length === 0
                        ? [
                            {
                              value: '',
                              label:
                                '— Không còn khóa học khả dụng chưa thêm —',
                            },
                          ]
                        : availableCourses.map((c) => ({
                            value: c.id,
                            label: `[${c.code}] ${c.title}`,
                          }))
                    }
                  />
                </div>
                <Button
                  disabled={!selectedCourseId}
                  loading={mutating}
                  onClick={handleAddCourse}
                  leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Thêm chặng
                </Button>
              </div>
            </Card>
          )}

          {path.pathCourses.length === 0 ? (
            <EmptyState
              title="Lộ trình chưa có khóa học nào"
              description="Hãy thêm các khóa học theo thứ tự học tập từ cơ bản tới bài thi tổng hợp cuối khóa."
            />
          ) : (
            <div className="space-y-4">
              {path.pathCourses.map((pc, idx) => {
                const c = pc.course;
                const courseLocked = isEmployee && c.state === 'LOCKED';
                const courseDone = c.state === 'COMPLETED';

                return (
                  <div
                    key={pc.id}
                    className={`rounded-lg border bg-white p-5 ${
                      courseLocked
                        ? 'border-slate-200 opacity-75'
                        : 'border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="accent">Chặng {pc.stepOrder}</Badge>
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            {c.code}
                          </span>
                          {courseDone && (
                            <Badge tone="success">Đã hoàn thành</Badge>
                          )}
                          {courseLocked && (
                            <Badge
                              tone="neutral"
                              icon={
                                <Lock
                                  className="h-3 w-3"
                                  strokeWidth={1.75}
                                />
                              }
                            >
                              Đang khóa (BR-02)
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {c.title}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!courseLocked && (
                          <Link href={`/courses/${c.id}`}>
                            <Button size="sm" variant="secondary">
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                              {isEmployee ? 'Vào học' : 'Mở khóa học'}
                            </Button>
                          </Link>
                        )}
                        {canEditStructure && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={idx === 0 || mutating}
                              onClick={() => handleMoveCourse(idx, -1)}
                            >
                              <ArrowUp
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={
                                idx === path.pathCourses.length - 1 || mutating
                              }
                              onClick={() => handleMoveCourse(idx, 1)}
                            >
                              <ArrowDown
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={mutating}
                              onClick={() => handleRemoveCourse(c.id)}
                              title="Gỡ khóa học khỏi lộ trình"
                            >
                              <Trash2
                                className="h-3.5 w-3.5 text-rose-700"
                                strokeWidth={1.75}
                              />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Modules preview inside Step */}
                    {c.modules && c.modules.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-[var(--border-default)] pt-3">
                        {c.modules.map((mod) => {
                          const modQuiz = mod.quiz;
                          return (
                            <div
                              key={mod.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded bg-[var(--bg-subtle)]/65 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {mod.state === 'COMPLETED' ? (
                                  <CheckCircle2
                                    className="h-3.5 w-3.5 text-emerald-600"
                                    strokeWidth={1.75}
                                  />
                                ) : mod.state === 'LOCKED' ? (
                                  <Lock
                                    className="h-3.5 w-3.5 text-slate-400"
                                    strokeWidth={1.75}
                                  />
                                ) : null}
                                <span className="font-medium text-[var(--text-primary)]">
                                  Học phần {mod.moduleOrder}: {mod.title}
                                </span>
                                <span className="text-[var(--text-muted)]">
                                  ({mod.lessons?.length ?? 0} bài giảng)
                                </span>
                              </div>

                              {modQuiz && (
                                <Badge
                                  tone={
                                    modQuiz.quizType === 'FINAL'
                                      ? 'warning'
                                      : 'info'
                                  }
                                >
                                  Quiz {modQuiz.quizType}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Structure Validator or Learner Rules Guide */}
        <aside className="lg:col-span-4">
          {isEmployee ? (
            <Card
              tinted
              title="Quy tắc mở khóa tuần tự (BR-02)"
              subtitle="Hướng dẫn hoàn thành lộ trình chuẩn"
            >
              <ul className="space-y-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                <li>
                  • Hoàn thành toàn bộ các bài giảng bắt buộc trong học phần để
                  mở khóa bài kiểm tra trắc nghiệm tương ứng.
                </li>
                <li>
                  • Đạt từ <strong>70% trở lên (BR-01)</strong> ở bài kiểm tra
                  học phần để mở khóa chặng tiếp theo.
                </li>
                <li>
                  • Bài kiểm tra ở cuối lộ trình sẽ tự động mở khóa khi toàn bộ
                  các học phần phía trước đã hoàn thành.
                </li>
              </ul>
            </Card>
          ) : (
            <Card
              title="Kiểm định điều kiện lộ trình"
              subtitle="Thêm tùy ý số khóa học — yêu cầu cuối lộ trình có bài Quiz đã xuất bản"
            >
              {!validation ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Đang kiểm tra cấu trúc lộ trình...
                </p>
              ) : (
                <div className="space-y-4">
                  <div
                    className={`flex items-center gap-2.5 rounded-md border p-3 text-xs font-medium ${
                      validation.valid
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    {validation.valid ? (
                      <ShieldCheck
                        className="h-5 w-5 shrink-0 text-emerald-700"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <AlertCircle
                        className="h-5 w-5 shrink-0 text-amber-700"
                        strokeWidth={1.75}
                      />
                    )}
                    <span>
                      {validation.valid
                        ? 'Cấu trúc lộ trình hợp lệ, sẵn sàng giao cho học viên!'
                        : 'Cấu trúc lộ trình chưa đủ điều kiện (cần có bài Quiz đã xuất bản ở cuối lộ trình).'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 border-b border-[var(--border-default)]">
                      <span className="text-[var(--text-secondary)]">
                        Quy mô lộ trình
                      </span>
                      <strong className="tabular-nums">
                        {path.pathCourses.length} khóa · {validation.unitCount}{' '}
                        học phần
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-[var(--border-default)]">
                      <span className="text-[var(--text-secondary)]">
                        Có bài Quiz ở cuối lộ trình
                      </span>
                      <strong>
                        {validation.hasFinal ? 'Đã có' : 'Chưa có'}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[var(--text-secondary)]">
                        Thứ tự bài Quiz cuối
                      </span>
                      <strong>
                        {validation.finalIsLast ? 'Đúng vị trí' : 'Chưa đúng'}
                      </strong>
                    </div>
                  </div>

                  {validation.issues.length > 0 && (
                    <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/70 p-3">
                      <p className="text-xs font-semibold text-rose-900">
                        Chi tiết cần bổ sung:
                      </p>
                      <ul className="space-y-1.5 text-xs text-rose-800">
                        {validation.issues.map((issue, i) => (
                          <li key={i}>• {formatValidationIssue(issue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
