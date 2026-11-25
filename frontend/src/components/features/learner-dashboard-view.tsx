'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Compass,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  POSITION_LABELS,
  formatDate,
  formatDaysRemaining,
  formatScore,
} from '@/lib/formatters';
import { learningPathsService } from '@/services/learning-paths.service';
import { progressService } from '@/services/progress.service';
import { reportsService } from '@/services/reports.service';
import type {
  DashboardResponse,
  LearningPathDetail,
  MyProgressResponse,
} from '@/types/api.types';
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives';

function formatVietnameseToday(): string {
  const days = [
    'CHỦ NHẬT',
    'THỨ HAI',
    'THỨ BA',
    'THỨ TƯ',
    'THỨ NĂM',
    'THỨ SÁU',
    'THỨ BẢY',
  ];
  const now = new Date();
  return `${days[now.getDay()]}, ${String(now.getDate()).padStart(
    2,
    '0',
  )} THÁNG ${now.getMonth() + 1}`;
}

export function LearnerDashboardView() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<MyProgressResponse | null>(null);
  const [pathDetail, setPathDetail] = useState<LearningPathDetail | null>(null);
  const [dash, setDash] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mountTimestamp] = useState<number>(() => Date.now());

  useEffect(() => {
    let active = true;
    Promise.all([
      progressService.getMyProgress(),
      reportsService.getDashboard().catch(() => null),
    ])
      .then(async ([progRes, dashRes]) => {
        if (!active) return;
        setProgress(progRes);
        setDash(dashRes);

        const firstPath = progRes.paths?.[0];
        if (firstPath) {
          const detail = await learningPathsService
            .getById(firstPath.pathId)
            .catch(() => null);
          if (active) setPathDetail(detail);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const shortName = (() => {
    if (!user?.fullName) return 'bạn';
    const parts = user.fullName.trim().split(/\s+/);
    return parts.length >= 2 ? parts.slice(-2).join(' ') : user.fullName;
  })();

  const estimatedDays = pathDetail?.estimatedDays || 30;
  const currentOnboardingDay = user?.createdAt
    ? Math.min(
        estimatedDays,
        Math.max(
          1,
          Math.floor(
            (mountTimestamp - new Date(user.createdAt).getTime()) / 86_400_000,
          ) + 1,
        ),
      )
    : 1;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-1/2" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-52 lg:col-span-8 rounded-xl" />
          <Skeleton className="h-52 lg:col-span-4 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const primaryPath = progress?.paths?.[0] ?? null;
  const nextUp = progress?.nextUp ?? null;
  const nextUpHref = nextUp
    ? nextUp.type === 'QUIZ'
      ? `/quizzes/${nextUp.id}`
      : `/courses/${nextUp.courseId}?lessonId=${nextUp.id}`
    : primaryPath
      ? `/learning-paths/${primaryPath.pathId}`
      : '/my-learning';

  // Count total lessons across primary path for "X / Y bài học"
  const totalPathLessons = pathDetail
    ? pathDetail.pathCourses.reduce(
        (acc, pc) =>
          acc +
          (pc.course.modules ?? []).reduce(
            (mAcc, mod) => mAcc + (mod.lessons?.length ?? 0),
            0,
          ),
        0,
      )
    : 0;
  const completedLessonsCount = dash?.completedLessonsCount ?? 0;

  // Nearest deadline item (prefer supplementary course if available, else primary upcoming)
  const nearestCourseDeadline =
    progress?.upcomingDeadlines?.find((d) => d.type === 'COURSE') ??
    progress?.upcomingDeadlines?.[0] ??
    null;
  const nearestDueBadge = nearestCourseDeadline
    ? formatDaysRemaining(nearestCourseDeadline.deadline)
    : null;

  // Flatten roadmap units from pathDetail for the 5-step card
  const roadmapUnits = (pathDetail?.pathCourses ?? []).flatMap((pc) =>
    (pc.course.modules ?? []).map((mod) => ({
      courseId: pc.courseId,
      courseTitle: pc.course.title,
      stepOrder: pc.stepOrder,
      moduleId: mod.id,
      moduleTitle: mod.title,
      dayStart: mod.dayStart,
      dayEnd: mod.dayEnd,
      lessonCount: mod.lessons?.length ?? 0,
      completedInMod: (mod.lessons ?? []).filter(
        (l) => l.state === 'COMPLETED',
      ).length,
      state: mod.state ?? pc.course.state ?? 'LOCKED',
      isFinal: mod.quiz?.quizType === 'FINAL',
    })),
  );

  const roleBadgeText = user
    ? `${user.position.charAt(0) + user.position.slice(1).toLowerCase()} · ${
        user.jobTitle || user.department || POSITION_LABELS[user.position]
      }`
    : '';

  return (
    <div className="space-y-8">
      {/* Editorial Greeting Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A8881]">
            {formatVietnameseToday()}
          </p>
          <h1 className="mt-1.5 text-[28px] sm:text-[32px] font-semibold leading-tight tracking-tight text-[#15221C]">
            Chào {shortName}, tiếp tục học nhé.
          </h1>
          <p className="mt-1 text-sm text-[#63726B]">
            Một bước nhỏ hôm nay, vững vàng hơn trong công việc.
          </p>
        </div>

        {roleBadgeText && (
          <span className="inline-flex shrink-0 items-center rounded-md bg-[#ECEFE8] px-3.5 py-1.5 text-xs font-medium text-[#4B5A53]">
            {roleBadgeText}
          </span>
        )}
      </div>

      {/* Top Row: Deep Forest Hero Card + Warm Stone Onboarding Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Deep #145343 Next Lesson Card */}
        <div className="lg:col-span-8 rounded-xl bg-[#155746] p-6 sm:p-7 text-white flex flex-col justify-between">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-12 sm:items-center">
            <div className="sm:col-span-8 sm:border-r sm:border-white/15 sm:pr-6 space-y-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/75">
                {nextUp?.type === 'QUIZ'
                  ? 'BÀI KIỂM TRA TIẾP THEO'
                  : 'BÀI HỌC TIẾP THEO'}
              </p>

              <h2 className="text-2xl font-semibold leading-snug text-white">
                {nextUp
                  ? nextUp.title
                  : primaryPath
                    ? primaryPath.title
                    : 'Sẵn sàng bắt đầu chương trình học'}
              </h2>

              <p className="text-sm text-emerald-100/85">
                {primaryPath?.currentUnit
                  ? primaryPath.currentUnit.title
                  : primaryPath
                    ? `Lộ trình ${primaryPath.code}`
                    : 'Chọn lộ trình hoặc khóa học được phân công để bắt đầu'}
              </p>

              <div className="flex items-center gap-2 pt-1 text-xs text-emerald-100/80">
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                <span>
                  {nextUp?.type === 'QUIZ'
                    ? 'Đánh giá trắc nghiệm (chuẩn >= 70%)'
                    : 'Học tuần tự mở khóa BR-02'}
                </span>
              </div>

              <div className="pt-3">
                <Link
                  href={nextUpHref}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-[#155746] hover:bg-emerald-50 transition-colors"
                >
                  <span>
                    {nextUp?.type === 'QUIZ'
                      ? 'Làm bài kiểm tra'
                      : 'Tiếp tục bài học'}
                  </span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              </div>
            </div>

            {/* Right Progress Block inside Green Card */}
            <div className="sm:col-span-4 sm:pl-2 space-y-2.5">
              <p className="text-4xl font-semibold tracking-tight text-white tabular-nums">
                {Math.round(primaryPath?.progressPercentage ?? 0)}%
              </p>
              <p className="text-xs text-emerald-100/80">
                lộ trình đã hoàn thành
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-[#8CE2B8] transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, primaryPath?.progressPercentage ?? 0),
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-emerald-100/80 tabular-nums">
                {totalPathLessons > 0
                  ? `${completedLessonsCount} / ${totalPathLessons} bài học`
                  : `${completedLessonsCount} bài học hoàn thành`}
              </p>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Warm Stone Onboarding Card */}
        <div className="lg:col-span-4 rounded-xl border border-[#E3E8DF] bg-[#EFF2EC] p-6 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6A7871]">
              ONBOARDING CỦA BẠN
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-[#15221C] tabular-nums">
                Ngày {String(currentOnboardingDay).padStart(2, '0')}
              </span>
              <span className="text-sm text-[#6A7871] tabular-nums">
                / {estimatedDays} ngày
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-[#2C3B34]">
              {primaryPath?.title ||
                (user ? POSITION_LABELS[user.position] : '')}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-[#DCE2D7] pt-4 text-xs">
            <span className="text-[#6A7871]">Hạn hoàn thành</span>
            <strong className="font-semibold text-[#15221C] tabular-nums">
              {primaryPath ? formatDate(primaryPath.deadline) : '—'}
            </strong>
          </div>
        </div>
      </div>

      {/* Bottom Row: 5-Step Roadmap List (Left 8) + Upcoming Deadline & Competency/Support (Right 4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Lộ trình của tôi */}
        <div className="lg:col-span-8 space-y-3.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#15221C]">
                Lộ trình của tôi
              </h2>
              <p className="text-xs text-[#6A7871]">
                4 học phần và 1 bài đánh giá tổng hợp
              </p>
            </div>
            <Link
              href={
                primaryPath
                  ? `/learning-paths/${primaryPath.pathId}`
                  : '/my-learning'
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#176552] hover:underline"
            >
              Xem toàn bộ lộ trình
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Link>
          </div>

          {roadmapUnits.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-5 w-5" strokeWidth={1.75} />}
              title="Chưa có lộ trình được giao"
              description="Khi bộ phận Nhân sự gán lộ trình vị trí, danh sách 5 chặng học tập sẽ hiển thị tại đây."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E2E7DF] bg-white divide-y divide-[#EBEEE8]">
              {roadmapUnits.map((unit, idx) => {
                const isDone = unit.state === 'COMPLETED';
                const isUnlocked = unit.state === 'UNLOCKED';
                const stepNum = String(idx + 1).padStart(2, '0');
                const dayLabel =
                  unit.dayStart && unit.dayEnd
                    ? `Ngày ${String(unit.dayStart).padStart(2, '0')}–${String(
                        unit.dayEnd,
                      ).padStart(2, '0')}`
                    : `Chặng ${stepNum}`;

                const rowContent = (
                  <div
                    className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors ${
                      isUnlocked
                        ? 'bg-[#EEF6F1] hover:bg-[#E5F1EA]'
                        : isDone
                          ? 'bg-white hover:bg-[#F9FBF9]'
                          : 'bg-white opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Circle Step Indicator */}
                      {isDone ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E4F2EC] text-[#176552]">
                          <Check className="h-4 w-4" strokeWidth={2} />
                        </span>
                      ) : isUnlocked ? (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#176552] text-xs font-semibold text-white tabular-nums">
                          {stepNum}
                        </span>
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F1F3EE] text-xs font-semibold text-[#7A8881] tabular-nums">
                          {stepNum}
                        </span>
                      )}

                      <div className="min-w-0">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isUnlocked || isDone
                              ? 'text-[#15221C]'
                              : 'text-[#5C6B64]'
                          }`}
                        >
                          {unit.moduleTitle || unit.courseTitle}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#6E7C75]">
                          {dayLabel} ·{' '}
                          {isDone
                            ? `${unit.lessonCount} bài học`
                            : isUnlocked
                              ? `Đã học ${unit.completedInMod} / ${unit.lessonCount} bài`
                              : unit.isFinal
                                ? 'Hoàn thành đủ 4 học phần để mở'
                                : `Đạt quiz học phần ${String(idx).padStart(
                                    2,
                                    '0',
                                  )} để mở`}
                        </p>
                      </div>
                    </div>

                    {/* Right Status Pill */}
                    <span
                      className={`shrink-0 rounded px-2.5 py-1 text-xs font-medium ${
                        isDone
                          ? 'bg-[#E4F2EC] text-[#145343]'
                          : isUnlocked
                            ? 'bg-[#DCEEE5] text-[#145343]'
                            : 'bg-[#F2F4F0] text-[#73827B]'
                      }`}
                    >
                      {isDone
                        ? 'Đã hoàn thành'
                        : isUnlocked
                          ? 'Đang học'
                          : 'Chưa mở'}
                    </span>
                  </div>
                );

                return isDone || isUnlocked ? (
                  <Link
                    key={unit.moduleId}
                    href={`/courses/${unit.courseId}`}
                    className="block"
                  >
                    {rowContent}
                  </Link>
                ) : (
                  <div key={unit.moduleId}>{rowContent}</div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Cols: Sắp đến hạn + Năng lực & Hỗ trợ */}
        <div className="lg:col-span-4 space-y-5 pt-1">
          {/* Upcoming Deadline Card */}
          <div className="rounded-xl border border-[#E2E7DF] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#15221C]">
                Sắp đến hạn
              </h3>
              {nearestDueBadge && (
                <span
                  className={`rounded px-2.5 py-0.5 text-xs font-medium ${
                    nearestDueBadge.tone === 'danger'
                      ? 'bg-rose-50 text-rose-800'
                      : 'bg-[#FBF3DF] text-[#9A6714]'
                  }`}
                >
                  {nearestDueBadge.text}
                </span>
              )}
            </div>

            {nearestCourseDeadline ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-[#15221C]">
                    {nearestCourseDeadline.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E7C75]">
                    {nearestCourseDeadline.type === 'COURSE'
                      ? 'Khóa học được giao bổ sung'
                      : 'Lộ trình vị trí bắt buộc'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-[#63726B]">
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>
                    Hoàn thành trước {formatDate(nearestCourseDeadline.deadline)}
                  </span>
                </div>

                <Link
                  href={
                    nearestCourseDeadline.type === 'PATH'
                      ? `/learning-paths/${nearestCourseDeadline.targetId}`
                      : `/courses/${nearestCourseDeadline.targetId}`
                  }
                  className="flex h-9.5 w-full items-center justify-center gap-1.5 rounded-md bg-[#EFF4F0] text-xs font-semibold text-[#176552] hover:bg-[#E2EDE6] transition-colors"
                >
                  <span>
                    {nearestCourseDeadline.type === 'PATH'
                      ? 'Xem lộ trình'
                      : 'Xem khóa học'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                </Link>
              </>
            ) : (
              <p className="py-3 text-xs text-[#6E7C75]">
                Hiện không có chương trình nào sắp chạm mốc hạn chót.
              </p>
            )}
          </div>

          {/* Competency & Support Card */}
          <div className="rounded-xl border border-[#E2E7DF] bg-white p-5 space-y-3">
            <h3 className="text-base font-semibold text-[#15221C]">
              Năng lực & Hỗ trợ học tập
            </h3>
            <div className="space-y-1 text-xs text-[#6E7C75]">
              <p>Điểm năng lực trung bình hiện tại</p>
              <p className="text-base font-semibold text-[#15221C] tabular-nums">
                {formatScore(dash?.competencySummary?.avgScore)} /{' '}
                {dash?.competencySummary?.requiredScore ?? 70} điểm chuẩn
              </p>
              <p>
                Đạt chuẩn: {dash?.competencySummary?.passedCount ?? 0} kỹ năng ·
                Cần bù: {dash?.competencySummary?.gapCount ?? 0} kỹ năng
              </p>
            </div>
            <div className="pt-1">
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#176552] hover:underline"
              >
                <span>Xem hồ sơ năng lực cá nhân</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Extra Assigned Standalone Courses (if more than shown in Sắp đến hạn) */}
      {progress?.courses && progress.courses.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#15221C]">
              Khóa học chuyên đề được giao ({progress.courses.length})
            </h2>
            <Link
              href="/my-learning"
              className="text-xs font-semibold text-[#176552] hover:underline"
            >
              Quản lý tất cả →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {progress.courses.map((c) => (
              <Link
                key={c.enrollmentId}
                href={`/courses/${c.courseId}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E7DF] bg-white p-4 hover:border-[#176552] transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-[#76857E]">
                    {c.code}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[#15221C]">
                    {c.title}
                  </p>
                  <p className="mt-1 text-xs text-[#6E7C75] tabular-nums">
                    Tiến độ {c.progressPercentage}% · Hạn {formatDate(c.deadline)}
                  </p>
                </div>
                <Button size="sm" variant="secondary">
                  Học
                </Button>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
