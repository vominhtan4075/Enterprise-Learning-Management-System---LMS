'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Compass,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  ROLE_LABELS,
  formatDateTime,
  formatPercent,
  formatScore,
} from '@/lib/formatters';
import { reportsService } from '@/services/reports.service';
import type { DashboardResponse } from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';
import {
  HorizontalBarList,
  ScoreDistributionBars,
} from '@/components/charts/simple-charts';

export function StaffDashboardView() {
  const { user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(
    async (fromVal?: string, toVal?: string) => {
      setLoading(true);
      try {
        const res = await reportsService.getDashboard({
          from: fromVal || undefined,
          to: toVal || undefined,
        });
        setData(res);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchDashboard]);

  const isTrainer = user?.role === 'TRAINER';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều hành đào tạo"
        description={
          isTrainer
            ? 'Theo dõi hiệu quả giảng dạy, tỷ lệ hoàn thành và kết quả kiểm tra của học viên thuộc các khóa học bạn phụ trách.'
            : 'Tổng hợp trực tiếp tình hình ghi danh, tiến độ lộ trình và chất lượng đào tạo trên toàn doanh nghiệp.'
        }
        badge={user ? <Badge tone="accent">{ROLE_LABELS[user.role]}</Badge> : null}
        action={
          isTrainer ? (
            <Link href="/courses">
              <Button leftIcon={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                Quản lý khóa học & Quiz
              </Button>
            </Link>
          ) : (
            <Link href="/enrollments">
              <Button
                leftIcon={
                  <ClipboardCheck className="h-4 w-4" strokeWidth={1.75} />
                }
              >
                Giao bài đào tạo
              </Button>
            </Link>
          )
        }
      />

      {/* Soft Ocean Blue Filter Toolbar */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-[var(--border-default)] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Từ ngày
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Đến ngày
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-md border border-[var(--border-default)] bg-white px-3 text-sm"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchDashboard(from, to)}
          >
            Lọc dữ liệu
          </Button>
          {(from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('');
                setTo('');
                void fetchDashboard('', '');
              }}
            >
              Đặt lại
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/competency">
            <Button variant="secondary" size="sm">
              <Award className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ma trận năng lực
            </Button>
          </Link>
          <Link href="/reports">
            <Button variant="secondary" size="sm">
              <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Báo cáo chi tiết
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : isTrainer ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Khóa học tôi tạo"
            value={data?.myCoursesCount ?? 0}
            hint="Bao gồm khóa xuất bản & bản nháp"
            icon={<BookOpen className="h-4 w-4" strokeWidth={1.75} />}
            tone="accent"
          />
          <StatCard
            label="Lượt ghi danh đã giao"
            value={data?.totalAssignedEnrollments ?? 0}
            hint={`Đã hoàn thành: ${data?.completedEnrollments ?? 0}`}
            icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
          />
          <StatCard
            label="Tỷ lệ hoàn thành"
            value={formatPercent(data?.completionRate)}
            hint="Tính trên các lượt giao của bạn"
            icon={<TrendingUp className="h-4 w-4" strokeWidth={1.75} />}
            tone="success"
          />
          <StatCard
            label="Lượt học quá hạn"
            value={data?.overdueEnrollments ?? 0}
            hint="Cần nhắc nhở hoặc gia hạn deadline"
            icon={<AlertTriangle className="h-4 w-4" strokeWidth={1.75} />}
            tone={(data?.overdueEnrollments ?? 0) > 0 ? 'danger' : 'default'}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Tổng nhân sự hoạt động"
            value={data?.totalUsers ?? data?.stats?.totalUsers ?? 0}
            hint={`Tổng lộ trình chuẩn: ${data?.totalPaths ?? 0}`}
            icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
            tone="accent"
          />
          <StatCard
            label="Tổng khóa học"
            value={data?.totalCourses ?? data?.stats?.activeCourses ?? 0}
            hint={`Tổng lượt ghi danh: ${data?.totalEnrollments ?? 0}`}
            icon={<BookOpen className="h-4 w-4" strokeWidth={1.75} />}
          />
          <StatCard
            label="Tỷ lệ hoàn thành chung"
            value={formatPercent(
              data?.completionRate ?? data?.stats?.completionRate,
            )}
            hint={`Hoàn thành ${data?.completedEnrollments ?? 0} · Quá hạn ${
              data?.overdueEnrollments ?? 0
            }`}
            icon={<TrendingUp className="h-4 w-4" strokeWidth={1.75} />}
            tone="success"
          />
          <StatCard
            label="Điểm bài thi trung bình"
            value={formatScore(data?.avgQuizScore ?? data?.stats?.averageScore)}
            hint={`${data?.totalQuizAttempts ?? 0} lượt nộp bài trắc nghiệm`}
            icon={<Award className="h-4 w-4" strokeWidth={1.75} />}
          />
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Card
            title="Tỷ lệ hoàn thành theo khóa học"
            subtitle="Thống kê tiến độ thực tế của học viên trên từng khóa học"
          >
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <HorizontalBarList
                items={(data?.courseCompletion ?? []).slice(0, 7).map((c, idx) => ({
                  id: c.courseId || c.code || String(idx),
                  label: c.title,
                  subLabel: c.code ? `(${c.code})` : undefined,
                  value: c.completionRate,
                  rightText:
                    c.totalEnrollments !== undefined
                      ? `${c.completedCount ?? 0}/${c.totalEnrollments} (${formatPercent(
                          c.completionRate,
                        )})`
                      : formatPercent(c.completionRate),
                }))}
              />
            )}
          </Card>
        </div>

        <div className="lg:col-span-5">
          <Card
            title="Phân phối phổ điểm Quiz"
            subtitle="Đánh giá mức độ nắm vững kiến thức qua các kỳ kiểm tra"
          >
            {loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ScoreDistributionBars buckets={data?.scoreDistribution} />
            )}
          </Card>
        </div>
      </div>

      {/* Bottom Row: Activities + Quick Shortcuts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Card
            title="Hoạt động đào tạo gần đây"
            subtitle="Nhật ký ghi nhận từ tiến độ học tập và nộp bài kiểm tra"
          >
            {!data?.activities || data.activities.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--text-muted)]">
                Chưa có hoạt động mới trong khoảng thời gian đã chọn.
              </p>
            ) : (
              <div className="divide-y divide-[var(--border-default)]">
                {data.activities.slice(0, 6).map((act, idx) => (
                  <div
                    key={act.id || idx}
                    className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {act.title || act.description || 'Cập nhật tiến độ đào tạo'}
                      </p>
                      {(act.description && act.title) && (
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                          {act.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-[var(--text-muted)] tabular-nums">
                      {formatDateTime(act.timestamp || act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card
            tinted
            title="Lối tắt nghiệp vụ"
            subtitle="Truy cập nhanh các phân hệ trọng tâm"
          >
            <div className="space-y-2.5">
              <Link
                href="/courses"
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                <span className="flex items-center gap-2">
                  <BookOpen
                    className="h-4 w-4 text-[var(--accent)]"
                    strokeWidth={1.75}
                  />
                  Kho khóa học & Ngân hàng Quiz
                </span>
                <span>→</span>
              </Link>

              <Link
                href="/learning-paths"
                className="flex items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
              >
                <span className="flex items-center gap-2">
                  <Compass
                    className="h-4 w-4 text-[var(--accent)]"
                    strokeWidth={1.75}
                  />
                  Lộ trình 5 cấp bậc vị trí
                </span>
                <span>→</span>
              </Link>

              {(user?.role === 'HR' || user?.role === 'ADMIN') && (
                <Link
                  href="/hrm"
                  className="flex items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw
                      className="h-4 w-4 text-[var(--accent)]"
                      strokeWidth={1.75}
                    />
                    Đồng bộ dữ liệu nhân sự HRM
                  </span>
                  <span>→</span>
                </Link>
              )}

              {user?.role === 'ADMIN' && (
                <Link
                  href="/users"
                  className="flex items-center justify-between rounded-md border border-[var(--border-default)] bg-white px-3.5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)]"
                >
                  <span className="flex items-center gap-2">
                    <Users
                      className="h-4 w-4 text-[var(--accent)]"
                      strokeWidth={1.75}
                    />
                    Quản trị tài khoản & Phân quyền
                  </span>
                  <span>→</span>
                </Link>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
