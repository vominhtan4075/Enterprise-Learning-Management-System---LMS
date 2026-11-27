'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, PlayCircle } from 'lucide-react';
import {
  ENROLLMENT_STATUS_LABELS,
  formatDate,
  formatDaysRemaining,
} from '@/lib/formatters';
import { progressService } from '@/services/progress.service';
import type { EnrollmentStatus, MyProgressResponse } from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  Tabs,
} from '@/components/ui/primitives';

export default function MyLearningPage() {
  const [data, setData] = useState<MyProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'PATHS' | 'COURSES'>('ALL');
  const [statusFilter, setStatusFilter] = useState<EnrollmentStatus | ''>('');

  useEffect(() => {
    progressService
      .getMyProgress()
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  const filteredPaths = useMemo(() => {
    const list = data?.paths ?? [];
    return statusFilter ? list.filter((p) => p.status === statusFilter) : list;
  }, [data?.paths, statusFilter]);

  const filteredCourses = useMemo(() => {
    const list = data?.courses ?? [];
    return statusFilter ? list.filter((c) => c.status === statusFilter) : list;
  }, [data?.courses, statusFilter]);

  const nextUp = data?.nextUp;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Học tập của tôi"
        description="Theo dõi lộ trình vị trí công việc và toàn bộ các khóa học chuyên môn đã được phân công."
        action={
          nextUp ? (
            <Link
              href={
                nextUp.type === 'QUIZ'
                  ? `/courses/${nextUp.courseId}?quizId=${nextUp.id}`
                  : `/courses/${nextUp.courseId}?lessonId=${nextUp.id}`
              }
            >
              <Button>
                <PlayCircle className="h-4 w-4" strokeWidth={1.75} />
                Tiếp tục: {nextUp.title}
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[280px]">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              {
                key: 'ALL',
                label: 'Tất cả',
                count: (data?.paths.length ?? 0) + (data?.courses.length ?? 0),
              },
              {
                key: 'PATHS',
                label: 'Lộ trình vị trí',
                count: data?.paths.length ?? 0,
              },
              {
                key: 'COURSES',
                label: 'Khóa học lẻ',
                count: data?.courses.length ?? 0,
              },
            ]}
          />
        </div>
        <div className="w-48 pb-4">
          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as EnrollmentStatus | '')
            }
            options={[
              { value: '', label: 'Mọi trạng thái' },
              { value: 'IN_PROGRESS', label: 'Đang theo học' },
              { value: 'COMPLETED', label: 'Đã hoàn thành' },
              { value: 'OVERDUE', label: 'Quá hạn' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {(tab === 'ALL' || tab === 'PATHS') && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Compass
                  className="h-4 w-4 text-[var(--accent)]"
                  strokeWidth={1.75}
                />
                Lộ trình phát triển theo cấp bậc ({filteredPaths.length})
              </h2>

              {filteredPaths.length === 0 ? (
                <EmptyState
                  title="Không có lộ trình phù hợp bộ lọc"
                  description="Thử chuyển bộ lọc trạng thái về Mọi trạng thái để xem đầy đủ lộ trình của bạn."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {filteredPaths.map((p) => {
                    const due = formatDaysRemaining(p.deadline);
                    return (
                      <Card key={p.enrollmentId} className="flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-xs font-mono text-[var(--text-muted)]">
                                {p.code}
                              </span>
                              <h3 className="mt-0.5 text-base font-semibold text-[var(--text-primary)]">
                                {p.title}
                              </h3>
                            </div>
                            <Badge
                              tone={
                                p.status === 'COMPLETED'
                                  ? 'success'
                                  : p.status === 'OVERDUE'
                                    ? 'danger'
                                    : 'accent'
                              }
                            >
                              {ENROLLMENT_STATUS_LABELS[p.status]}
                            </Badge>
                          </div>

                          {p.currentUnit && (
                            <p className="rounded bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                              Học phần hiện tại:{' '}
                              <strong className="text-[var(--text-primary)]">
                                {p.currentUnit.title}
                              </strong>
                            </p>
                          )}

                          <ProgressBar
                            value={p.progressPercentage}
                            showLabel
                            tone={
                              p.status === 'COMPLETED' ? 'success' : 'accent'
                            }
                          />

                          <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-secondary)]">
                            <span>
                              Hoàn thành {p.completedCourses}/{p.totalCourses}{' '}
                              khóa · Hạn {formatDate(p.deadline)} ({due.text})
                            </span>
                            <Link
                              href={`/learning-paths/${p.pathId}`}
                              className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                            >
                              Vào lộ trình
                              <ArrowRight
                                className="h-3.5 w-3.5"
                                strokeWidth={1.75}
                              />
                            </Link>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {(tab === 'ALL' || tab === 'COURSES') && (
            <section className="space-y-4">
              <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <BookOpen
                  className="h-4 w-4 text-[var(--accent)]"
                  strokeWidth={1.75}
                />
                Khóa học chuyên đề ({filteredCourses.length})
              </h2>

              {filteredCourses.length === 0 ? (
                <EmptyState
                  title="Chưa có khóa học chuyên đề lẻ"
                  description="Các khóa học được gán bổ sung ngoài lộ trình chính sẽ xuất hiện tại đây."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCourses.map((c) => {
                    const due = formatDaysRemaining(c.deadline);
                    return (
                      <Card key={c.enrollmentId}>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-[var(--text-muted)]">
                              {c.code}
                            </span>
                            <Badge tone={due.tone}>{due.text}</Badge>
                          </div>
                          <h3 className="text-base font-semibold text-[var(--text-primary)] line-clamp-2">
                            {c.title}
                          </h3>
                          <ProgressBar
                            value={c.progressPercentage}
                            showLabel
                            tone={
                              c.status === 'COMPLETED' ? 'success' : 'accent'
                            }
                          />
                          <div className="flex items-center justify-between pt-2 text-xs text-[var(--text-secondary)]">
                            <span>Hạn: {formatDate(c.deadline)}</span>
                            <Link
                              href={`/courses/${c.courseId}`}
                              className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                            >
                              Vào phòng học →
                            </Link>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
