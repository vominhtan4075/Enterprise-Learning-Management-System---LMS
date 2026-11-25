'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  ENROLLMENT_STATUS_LABELS,
  POSITION_LABELS,
  formatDate,
  formatDaysRemaining,
  formatPercent,
  formatScore,
} from '@/lib/formatters';
import { progressService } from '@/services/progress.service';
import { reportsService } from '@/services/reports.service';
import type {
  DashboardResponse,
  MyProgressResponse,
  PersonalCompetencyResponse,
} from '@/types/api.types';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatCard,
} from '@/components/ui/primitives';
import { ScoreDistributionBars } from '@/components/charts/simple-charts';

export default function LearnerProgressPage() {
  const { user } = useAuth();

  const [progress, setProgress] = useState<MyProgressResponse | null>(null);
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [competency, setCompetency] =
    useState<PersonalCompetencyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      progressService.getMyProgress(),
      reportsService.getDashboard().catch(() => null),
      reportsService.getMyCompetency().catch(() => null),
    ])
      .then(([progRes, dashRes, compRes]) => {
        if (!active) return;
        setProgress(progRes);
        setDash(dashRes);
        setCompetency(compRes);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-14 w-1/2" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const paths = progress?.paths ?? [];
  const courses = progress?.courses ?? [];
  const totalPrograms = paths.length + courses.length;
  const completedPrograms =
    paths.filter((p) => p.status === 'COMPLETED').length +
    courses.filter((c) => c.status === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tiến độ học tập"
        description="Theo dõi tổng thể mức độ hoàn thành các lộ trình, khóa học, kết quả bài kiểm tra và mức độ đáp ứng kỹ năng vị trí."
        badge={
          user ? (
            <Badge tone="accent">{POSITION_LABELS[user.position]}</Badge>
          ) : undefined
        }
      />

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bài giảng hoàn thành"
          value={dash?.completedLessonsCount ?? 0}
          hint="Tích lũy trên toàn bộ học phần"
          icon={<BookOpen className="h-4 w-4" strokeWidth={1.75} />}
          tone="accent"
        />
        <StatCard
          label="Bài kiểm tra vượt qua"
          value={dash?.passedQuizzesCount ?? 0}
          hint={`Tổng ${dash?.totalQuizAttempts ?? 0} lượt nộp bài`}
          icon={<ClipboardCheck className="h-4 w-4" strokeWidth={1.75} />}
          tone="success"
        />
        <StatCard
          label="Điểm Quiz trung bình"
          value={formatScore(dash?.avgQuizScore)}
          hint="Chuẩn vượt qua >= 70 điểm"
          icon={<Award className="h-4 w-4" strokeWidth={1.75} />}
        />
        <StatCard
          label="Chương trình hoàn tất"
          value={`${completedPrograms} / ${totalPrograms}`}
          hint="Gồm lộ trình vị trí & khóa học lẻ"
          icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />}
        />
      </div>

      {/* Main 2-Column Progress Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Detailed Enrollment Progress */}
        <div className="space-y-6 lg:col-span-7">
          <Card
            title="Tiến độ Lộ trình & Khóa học đang tham gia"
            subtitle="Tỷ lệ hoàn thành được tính tự động từ bài giảng bắt buộc và bài kiểm tra đã đạt"
          >
            {totalPrograms === 0 ? (
              <EmptyState
                icon={<Compass className="h-5 w-5" strokeWidth={1.75} />}
                title="Chưa có chương trình học nào được giao"
                description="Khi bạn được phân công lộ trình hoặc khóa học mới, tiến độ chi tiết sẽ hiển thị tại đây."
              />
            ) : (
              <div className="space-y-4">
                {paths.map((p) => {
                  const due = formatDaysRemaining(p.deadline);
                  return (
                    <div
                      key={p.enrollmentId}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]/50 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge tone="accent">Lộ trình</Badge>
                            <span className="font-mono text-xs text-[var(--text-muted)]">
                              {p.code}
                            </span>
                          </div>
                          <h3 className="mt-1 text-base font-semibold text-[var(--text-primary)]">
                            {p.title}
                          </h3>
                        </div>
                        <Badge
                          tone={
                            p.status === 'COMPLETED'
                              ? 'success'
                              : p.status === 'OVERDUE'
                                ? 'danger'
                                : due.tone
                          }
                        >
                          {p.status === 'COMPLETED'
                            ? ENROLLMENT_STATUS_LABELS.COMPLETED
                            : due.text}
                        </Badge>
                      </div>

                      <ProgressBar
                        value={p.progressPercentage}
                        showLabel
                        tone={p.status === 'COMPLETED' ? 'success' : 'accent'}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                        <span>
                          Hoàn thành {p.completedCourses}/{p.totalCourses} chặng
                          khóa học · Hạn {formatDate(p.deadline)}
                        </span>
                        <Link
                          href={`/learning-paths/${p.pathId}`}
                          className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                        >
                          Chi tiết lộ trình
                          <ArrowRight
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {courses.map((c) => {
                  const due = formatDaysRemaining(c.deadline);
                  return (
                    <div
                      key={c.enrollmentId}
                      className="rounded-lg border border-[var(--border-default)] bg-white p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge tone="neutral">Khóa học lẻ</Badge>
                            <span className="font-mono text-xs text-[var(--text-muted)]">
                              {c.code}
                            </span>
                          </div>
                          <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                            {c.title}
                          </h3>
                        </div>
                        <Badge
                          tone={
                            c.status === 'COMPLETED'
                              ? 'success'
                              : c.status === 'OVERDUE'
                                ? 'danger'
                                : due.tone
                          }
                        >
                          {c.status === 'COMPLETED'
                            ? ENROLLMENT_STATUS_LABELS.COMPLETED
                            : due.text}
                        </Badge>
                      </div>

                      <ProgressBar
                        value={c.progressPercentage}
                        size="sm"
                        showLabel
                        tone={c.status === 'COMPLETED' ? 'success' : 'accent'}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                        <span>
                          {c.completedModules ?? 0}/{c.totalModules ?? 0} học
                          phần · Hạn {formatDate(c.deadline)}
                        </span>
                        <Link
                          href={`/courses/${c.courseId}`}
                          className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
                        >
                          Vào phòng học
                          <ArrowRight
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Phổ điểm các lượt làm bài kiểm tra"
            subtitle="Thống kê phân bố điểm số qua các lần nộp bài trắc nghiệm"
          >
            <ScoreDistributionBars buckets={dash?.scoreDistribution} />
          </Card>
        </div>

        {/* Right: Competency Skill Progress */}
        <div className="lg:col-span-5">
          <Card
            title="Mức độ đạt chuẩn kỹ năng vị trí"
            subtitle={
              user
                ? `Đối chiếu kết quả đánh giá với chuẩn ${POSITION_LABELS[user.position]}`
                : 'Tổng hợp tự động từ điểm bài kiểm tra Quiz'
            }
            action={
              competency ? (
                <Badge tone="accent">
                  Chuẩn: {competency.requiredScore} điểm
                </Badge>
              ) : undefined
            }
          >
            {!competency || competency.competencies.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-5 py-10 text-center">
                <Award
                  className="mx-auto mb-2 h-7 w-7 text-[var(--accent)]"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Chưa phát sinh điểm đánh giá kỹ năng
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Hoàn thành các bài kiểm tra Quiz trong khóa học để hệ thống tự
                  động cập nhật biểu đồ kỹ năng của bạn.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-center">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Điểm TB
                    </p>
                    <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatScore(competency.avgScore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Đạt chuẩn
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-700 tabular-nums">
                      {competency.passedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Cần bù (GAP)
                    </p>
                    <p className="mt-1 text-xl font-semibold text-rose-700 tabular-nums">
                      {competency.gapCount}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {competency.competencies.map((skill) => {
                    const isPassed = skill.status === 'PASSED';
                    return (
                      <div
                        key={skill.skillName}
                        className="rounded-md border border-[var(--border-default)] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                            <UserCheck
                              className="h-4 w-4 text-[var(--accent)]"
                              strokeWidth={1.75}
                            />
                            {skill.skillName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                              {formatPercent(skill.score)} /{' '}
                              {skill.requiredScore}%
                            </span>
                            <Badge tone={isPassed ? 'success' : 'danger'}>
                              {isPassed ? 'Đạt chuẩn' : 'Cần cải thiện'}
                            </Badge>
                          </div>
                        </div>
                        <ProgressBar
                          value={skill.score}
                          tone={isPassed ? 'success' : 'danger'}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
