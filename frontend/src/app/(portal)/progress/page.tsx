'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  POSITION_LABELS,
  formatDate,
  formatDaysRemaining,
  formatScore,
} from '@/lib/formatters';
import { progressService } from '@/services/progress.service';
import { reportsService } from '@/services/reports.service';
import type {
  CompetencyEmployeeSkill,
  DashboardResponse,
  MyProgressResponse,
  PersonalCompetencyResponse,
} from '@/types/api.types';
import { EmptyState, ProgressBar, Skeleton } from '@/components/ui/primitives';

interface DonutSegment {
  key: string;
  label: string;
  pct: number;
  color: string;
  dotClass: string;
  countText: string;
}

function ProgressDonutChart({
  overallPct,
  segments,
  hasPrograms,
}: {
  overallPct: number;
  segments: DonutSegment[];
  hasPrograms: boolean;
}) {
  const size = 168;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const activeSegments = segments.filter((s) => s.pct > 0.2);

  // Precompute cumulative dash offsets cleanly without mutating during render
  const renderedArcs = activeSegments.reduce<
    Array<DonutSegment & { length: number; offset: number }>
  >((acc, seg) => {
    const prevEnd =
      acc.length > 0 ? acc[acc.length - 1].offset - acc[acc.length - 1].length : 0;
    const length = (seg.pct / 100) * circumference;
    acc.push({
      ...seg,
      length,
      offset: prevEnd,
    });
    return acc;
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
      <div
        className="relative inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ECEFE9"
            strokeWidth={strokeWidth}
          />
          {hasPrograms &&
            renderedArcs.map((arc) => (
              <circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.length} ${circumference}`}
                strokeDashoffset={arc.offset}
                strokeLinecap={renderedArcs.length === 1 ? 'round' : 'butt'}
                className="transition-all duration-500"
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-bold tracking-tight text-[#15221C] tabular-nums">
            {overallPct}%
          </span>
          <span className="mt-0.5 text-[11px] font-medium text-[#6E7C75]">
            hoàn thành
          </span>
        </div>
      </div>

      <div className="w-full sm:w-auto space-y-2.5">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="flex items-center justify-between gap-5 text-xs sm:justify-start"
          >
            <span className="inline-flex items-center gap-2 text-[#4B5A53]">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.dotClass}`} />
              <span>{seg.label}</span>
            </span>
            <strong className="font-semibold text-[#15221C] tabular-nums sm:ml-auto">
              {seg.countText}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkillColumnChart({
  skills,
  requiredScore,
}: {
  skills: CompetencyEmployeeSkill[];
  requiredScore: number;
}) {
  const yTicks = [100, 75, 50, 25, 0];
  const benchmarkPct = Math.min(100, Math.max(0, requiredScore));
  const count = skills.length;
  const isDense = count >= 7;
  const isVeryDense = count >= 10;

  const gridSpacingClass = isVeryDense
    ? 'gap-1 px-1.5 sm:px-2'
    : isDense
      ? 'gap-1.5 sm:gap-2.5 px-2 sm:px-3.5'
      : 'gap-2.5 sm:gap-4 px-3 sm:px-5';

  const scoreTextClass = isVeryDense
    ? 'text-[9px] sm:text-[10px]'
    : isDense
      ? 'text-[10px] sm:text-[11px]'
      : 'text-xs';

  const xLabelTextClass = isVeryDense
    ? 'text-[10px] leading-tight'
    : isDense
      ? 'text-[11px] leading-snug'
      : 'text-xs leading-snug';

  return (
    <div className="w-full">
      {/* Plot Area (pt-5 reserves clean headroom for 100% column labels) */}
      <div className="flex items-stretch gap-2 sm:gap-2.5 pt-5">
        {/* Y-Axis Labels */}
        <div className="flex h-48 w-8 sm:w-9 shrink-0 flex-col justify-between text-right text-[11px] text-[#7A8881] tabular-nums">
          {yTicks.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}%
            </span>
          ))}
        </div>

        {/* Grid + Benchmark Line + Fluid Columns */}
        <div className="relative h-48 min-w-0 flex-1 border-b border-[#CFD8CE]">
          {/* Horizontal Gridlines */}
          {[25, 50, 75, 100].map((line) => (
            <div
              key={line}
              className="pointer-events-none absolute inset-x-0 border-t border-[#EEF1EC]"
              style={{ bottom: `${line}%` }}
            />
          ))}

          {/* Required Score Dashed Benchmark Line */}
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-[#15221C]/35"
            style={{ bottom: `${benchmarkPct}%` }}
          />

          {/* Auto-scaling Columns */}
          <div
            className={`relative z-20 grid h-full items-end ${gridSpacingClass}`}
            style={{
              gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
            }}
          >
            {skills.map((skill) => {
              const clamped = Math.min(
                100,
                Math.max(0, Math.round(skill.score * 10) / 10),
              );
              const isPassed =
                skill.status === 'PASSED' ||
                skill.score >= skill.requiredScore;

              return (
                <div
                  key={skill.skillName}
                  title={`${skill.skillName}: ${formatScore(skill.score)}% (Chuẩn ${skill.requiredScore}%)`}
                  className="group relative flex h-full min-w-0 items-end justify-center"
                >
                  <div
                    className={`relative w-[68%] max-w-[48px] min-w-[8px] transition-all duration-500 ${
                      isVeryDense ? 'rounded-t-sm' : 'rounded-t-md'
                    } ${
                      isPassed
                        ? 'bg-[#176552] group-hover:bg-[#125040]'
                        : 'bg-[#E59A28] group-hover:bg-[#CF861B]'
                    }`}
                    style={{ height: `${Math.max(4, clamped)}%` }}
                  >
                    <span
                      className={`absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-semibold leading-none tabular-nums ${scoreTextClass} ${
                        isPassed ? 'text-[#145343]' : 'text-[#B45309]'
                      }`}
                    >
                      {formatScore(skill.score)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* X-Axis Skill Labels */}
      <div className="mt-2.5 flex gap-2 sm:gap-2.5">
        <div className="w-8 sm:w-9 shrink-0" />
        <div
          className={`grid min-w-0 flex-1 ${gridSpacingClass}`}
          style={{
            gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
          }}
        >
          {skills.map((skill) => (
            <p
              key={skill.skillName}
              title={skill.skillName}
              className={`min-w-0 w-full break-words line-clamp-2 text-center font-medium text-[#2C3B34] ${xLabelTextClass}`}
            >
              {skill.skillName}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-80 rounded-xl lg:col-span-5" />
          <Skeleton className="h-80 rounded-xl lg:col-span-7" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const paths = progress?.paths ?? [];
  const courses = progress?.courses ?? [];
  const allEnrollments = [...paths, ...courses];
  const totalPrograms = allEnrollments.length;

  const completedPrograms = allEnrollments.filter(
    (item) => item.status === 'COMPLETED',
  ).length;
  const overduePrograms = allEnrollments.filter((item) => {
    if (item.status === 'COMPLETED') return false;
    return (
      item.status === 'OVERDUE' ||
      formatDaysRemaining(item.deadline).tone === 'danger'
    );
  }).length;
  const inProgressPrograms = Math.max(
    0,
    totalPrograms - completedPrograms - overduePrograms,
  );

  // Compute proportional shares for the Donut chart so partial completion is accurately reflected
  let completedShare = 0;
  let overdueRemainingShare = 0;
  let activeRemainingShare = 0;

  if (totalPrograms > 0) {
    let sumCompleted = 0;
    let sumOverdueRem = 0;
    let sumActiveRem = 0;

    for (const item of allEnrollments) {
      const pct = Math.min(100, Math.max(0, Number(item.progressPercentage ?? 0)));
      const rem = 100 - pct;
      sumCompleted += pct;

      const isOverdue =
        item.status !== 'COMPLETED' &&
        (item.status === 'OVERDUE' ||
          formatDaysRemaining(item.deadline).tone === 'danger');

      if (isOverdue) {
        sumOverdueRem += rem;
      } else {
        sumActiveRem += rem;
      }
    }

    completedShare = sumCompleted / totalPrograms;
    overdueRemainingShare = sumOverdueRem / totalPrograms;
    activeRemainingShare = sumActiveRem / totalPrograms;
  }

  const overallProgress = Math.round(completedShare);

  const donutSegments: DonutSegment[] = [
    {
      key: 'completed',
      label: 'Đã hoàn thành',
      pct: completedShare,
      color: '#176552',
      dotClass: 'bg-[#176552]',
      countText: `${completedPrograms} chương trình`,
    },
    {
      key: 'in-progress',
      label: 'Đang theo học',
      pct: activeRemainingShare,
      color: '#88C9A8',
      dotClass: 'bg-[#88C9A8]',
      countText: `${inProgressPrograms} chương trình`,
    },
    ...(overduePrograms > 0 || overdueRemainingShare > 0
      ? [
          {
            key: 'overdue',
            label: 'Quá hạn',
            pct: overdueRemainingShare,
            color: '#E05A5A',
            dotClass: 'bg-[#E05A5A]',
            countText: `${overduePrograms} chương trình`,
          },
        ]
      : []),
  ];

  const hasQuizAttempts =
    (dash?.totalQuizAttempts ?? 0) > 0 &&
    dash?.avgQuizScore !== null &&
    dash?.avgQuizScore !== undefined;

  const requiredScore = competency?.requiredScore ?? 70;
  const skills = competency?.competencies ?? [];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Page Header */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-[#15221C]">
            Tiến độ học tập
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-[#63726B]">
            Biểu đồ tổng hợp tỷ lệ hoàn thành chương trình và điểm kỹ năng theo
            vị trí của bạn.
          </p>
        </div>

        {user && (
          <span className="inline-flex w-fit shrink-0 items-center rounded-md bg-[#ECEFE8] px-3 py-1 text-xs font-medium text-[#4B5A53]">
            Vị trí: {POSITION_LABELS[user.position]}
          </span>
        )}
      </div>

      {/* Top Row: Donut Chart (5 cols) + Skill Vertical Bar Chart (7 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 5 Cols: Donut Chart Card */}
        <section className="lg:col-span-5 rounded-xl border border-[#E2E7DF] bg-white p-6 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#15221C]">
              Tổng quan tiến độ
            </h2>
            <p className="mt-0.5 text-xs text-[#6E7C75]">
              Tỷ trọng hoàn thành trên {totalPrograms} chương trình được giao
            </p>
          </div>

          <ProgressDonutChart
            overallPct={overallProgress}
            segments={donutSegments}
            hasPrograms={totalPrograms > 0}
          />

          <div className="grid grid-cols-3 divide-x divide-[#EBEEE8] border-t border-[#EBEEE8] pt-4 text-center">
            <div className="px-2">
              <p className="text-lg font-semibold text-[#15221C] tabular-nums">
                {dash?.completedLessonsCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-[#6E7C75]">Bài học xong</p>
            </div>
            <div className="px-2">
              <p className="text-lg font-semibold text-[#176552] tabular-nums">
                {dash?.passedQuizzesCount ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-[#6E7C75]">Bài thi đạt</p>
            </div>
            <div className="px-2">
              <p className="text-lg font-semibold text-[#15221C] tabular-nums">
                {hasQuizAttempts ? `${formatScore(dash?.avgQuizScore)}%` : '—'}
              </p>
              <p className="mt-0.5 text-[11px] text-[#6E7C75]">Điểm TB</p>
            </div>
          </div>
        </section>

        {/* Right 7 Cols: Vertical Bar Chart Card */}
        <section className="lg:col-span-7 rounded-xl border border-[#E2E7DF] bg-white p-6 flex flex-col justify-between space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#15221C]">
                Điểm kỹ năng theo vị trí
              </h2>
              <p className="mt-0.5 text-xs text-[#6E7C75]">
                So sánh điểm đạt được với mức chuẩn yêu cầu ({requiredScore}%)
              </p>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#586760]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#176552]" />
                  Đạt chuẩn
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#E59A28]" />
                  Cần củng cố
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 border-t-2 border-dashed border-[#15221C]/50" />
                  Chuẩn {requiredScore}%
                </span>
              </div>
            )}
          </div>

          {skills.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[#DCE3DA] bg-[#FAFBF9] px-6 py-10 text-center">
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF4F0] text-[#176552]">
                <Award className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-semibold text-[#15221C]">
                Chưa có dữ liệu biểu đồ kỹ năng
              </p>
              <p className="mt-1 max-w-sm text-xs text-[#6E7C75]">
                Hoàn thành các bài kiểm tra trong khóa học để hiển thị cột điểm
                cho từng nhóm kỹ năng tại đây.
              </p>
            </div>
          ) : (
            <SkillColumnChart skills={skills} requiredScore={requiredScore} />
          )}
        </section>
      </div>

      {/* Bottom Row: Clean Assigned Programs List */}
      <section className="space-y-3.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#15221C]">
              Chi tiết từng chương trình
            </h2>
            <p className="text-xs text-[#6A7871]">
              Nhấn vào lộ trình hoặc khóa học bất kỳ để tiếp tục học
            </p>
          </div>
          <Link
            href="/my-learning"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#176552] hover:underline"
          >
            Mở Khóa học của tôi
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        {totalPrograms === 0 ? (
          <EmptyState
            icon={<Compass className="h-5 w-5" strokeWidth={1.75} />}
            title="Chưa có chương trình học nào được giao"
            description="Khi bộ phận Nhân sự phân công lộ trình hoặc khóa học mới, danh sách sẽ hiển thị tại đây."
          />
        ) : (
          <div className="divide-y divide-[#EBEEE8] overflow-hidden rounded-xl border border-[#E2E7DF] bg-white">
            {paths.map((p) => {
              const due = formatDaysRemaining(p.deadline);
              const isCompleted = p.status === 'COMPLETED';
              const isOverdue = p.status === 'OVERDUE' || due.tone === 'danger';

              return (
                <Link
                  key={p.enrollmentId}
                  href={`/learning-paths/${p.pathId}`}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-[#F8FAF8] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF4F0] text-[#176552]">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
                      ) : (
                        <Compass className="h-5 w-5" strokeWidth={1.75} />
                      )}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-[#176552]">
                        Lộ trình đào tạo
                      </span>
                      <h3 className="truncate text-[15px] font-semibold text-[#15221C]">
                        {p.title}
                      </h3>
                      <p className="text-xs text-[#6E7C75]">
                        Đã xong {p.completedCourses}/{p.totalCourses} khóa học
                        {' · '}
                        {isCompleted ? (
                          <span className="font-medium text-[#145343]">
                            Đã hoàn thành
                          </span>
                        ) : (
                          <span
                            className={
                              isOverdue ? 'font-medium text-rose-700' : ''
                            }
                          >
                            Hạn {formatDate(p.deadline)} ({due.text})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-52 sm:shrink-0">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6E7C75]">Tiến độ</span>
                        <span className="font-semibold text-[#15221C] tabular-nums">
                          {Math.round(p.progressPercentage)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={p.progressPercentage}
                        size="sm"
                        tone={isCompleted ? 'success' : 'accent'}
                      />
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[#8A9891]"
                      strokeWidth={1.75}
                    />
                  </div>
                </Link>
              );
            })}

            {courses.map((c) => {
              const due = formatDaysRemaining(c.deadline);
              const isCompleted = c.status === 'COMPLETED';
              const isOverdue = c.status === 'OVERDUE' || due.tone === 'danger';

              return (
                <Link
                  key={c.enrollmentId}
                  href={`/courses/${c.courseId}`}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-[#F8FAF8] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3.5">
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                        isCompleted
                          ? 'bg-[#EEF4F0] text-[#176552]'
                          : 'bg-[#F1F3EE] text-[#4B5A53]'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5" strokeWidth={1.75} />
                      ) : (
                        <BookOpen className="h-5 w-5" strokeWidth={1.75} />
                      )}
                    </span>

                    <div className="min-w-0 space-y-1">
                      <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-[#6A7871]">
                        Khóa học chuyên đề
                      </span>
                      <h3 className="truncate text-[15px] font-semibold text-[#15221C]">
                        {c.title}
                      </h3>
                      <p className="text-xs text-[#6E7C75]">
                        {c.totalModules !== undefined && (
                          <>
                            Đã xong {c.completedModules ?? 0}/{c.totalModules}{' '}
                            học phần ·{' '}
                          </>
                        )}
                        {isCompleted ? (
                          <span className="font-medium text-[#145343]">
                            Đã hoàn thành
                          </span>
                        ) : (
                          <span
                            className={
                              isOverdue ? 'font-medium text-rose-700' : ''
                            }
                          >
                            Hạn {formatDate(c.deadline)} ({due.text})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-52 sm:shrink-0">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6E7C75]">Tiến độ</span>
                        <span className="font-semibold text-[#15221C] tabular-nums">
                          {Math.round(c.progressPercentage)}%
                        </span>
                      </div>
                      <ProgressBar
                        value={c.progressPercentage}
                        size="sm"
                        tone={isCompleted ? 'success' : 'accent'}
                      />
                    </div>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[#8A9891]"
                      strokeWidth={1.75}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
