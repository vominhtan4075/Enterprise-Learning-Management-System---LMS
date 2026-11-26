'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, CheckCircle2, ClipboardList, Users } from 'lucide-react';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  POSITION_LABELS,
  POSITION_LEVELS,
  formatPercent,
  formatScore,
} from '@/lib/formatters';
import { coursesService } from '@/services/courses.service';
import { reportsService } from '@/services/reports.service';
import type {
  CompletionReportResponse,
  CourseSummary,
  PositionLevel,
  QuizScoresReportResponse,
} from '@/types/api.types';
import {
  Badge,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  StatCard,
  Tabs,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/data-table';
import { HorizontalBarList } from '@/components/charts/simple-charts';

export default function DetailedReportsPage() {
  const { error: showError } = useToast();

  const [tab, setTab] = useState<'COMPLETION' | 'QUIZ_SCORES'>('COMPLETION');
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState<PositionLevel | ''>('');
  const [courseId, setCourseId] = useState('');

  const [completion, setCompletion] = useState<CompletionReportResponse | null>(
    null,
  );
  const [quizScores, setQuizScores] = useState<QuizScoresReportResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    coursesService
      .getAll({ limit: 100 })
      .then((res) => setCourses(res.data ?? []))
      .catch(() => setCourses([]));
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'COMPLETION') {
        const res = await reportsService.getCompletion({
          department: department.trim() || undefined,
          position: position || undefined,
          courseId: courseId || undefined,
        });
        setCompletion(res);
      } else {
        const res = await reportsService.getQuizScores({
          courseId: courseId || undefined,
        });
        setQuizScores(res);
      }
    } catch (err) {
      showError(
        'Không thể tải báo cáo đào tạo',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [tab, department, position, courseId, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadReports();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadReports]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo & Thống kê Đào tạo"
        description="Phân tích chuyên sâu tỷ lệ hoàn thành chương trình theo phòng ban, nhân sự và đánh giá chất lượng các đề kiểm tra Quiz."
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'COMPLETION', label: 'Tiến độ hoàn thành (Completion)' },
          { key: 'QUIZ_SCORES', label: 'Chất lượng bài thi (Quiz Scores)' },
        ]}
      />

      {/* Filter Bar */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-3">
        <Select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          options={[
            { value: '', label: 'Tất cả khóa học' },
            ...courses.map((c) => ({
              value: c.id,
              label: `[${c.code}] ${c.title}`,
            })),
          ]}
        />
        {tab === 'COMPLETION' && (
          <>
            <Input
              placeholder="Lọc theo phòng ban..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Select
              value={position}
              onChange={(e) => setPosition(e.target.value as PositionLevel | '')}
              options={[
                { value: '', label: 'Mọi cấp bậc vị trí' },
                ...POSITION_LEVELS.map((lvl) => ({
                  value: lvl,
                  label: POSITION_LABELS[lvl],
                })),
              ]}
            />
          </>
        )}
      </div>

      {tab === 'COMPLETION' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Tổng lượt ghi danh"
              value={completion?.summary.totalEnrollments ?? 0}
              icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="Đã hoàn thành"
              value={completion?.summary.totalCompleted ?? 0}
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="Đang quá hạn"
              value={completion?.summary.totalOverdue ?? 0}
              tone={
                (completion?.summary.totalOverdue ?? 0) > 0
                  ? 'danger'
                  : 'default'
              }
            />
            <StatCard
              label="Tỷ lệ hoàn thành chung"
              value={formatPercent(completion?.summary.overallCompletionRate)}
              tone="accent"
            />
          </div>

          <Card
            title="So sánh tỷ lệ hoàn thành giữa các Phòng ban"
            subtitle="Đối chiếu tỷ lệ hoàn thành và tiến độ trung bình của từng đơn vị"
          >
            <HorizontalBarList
              items={(completion?.byDepartment ?? []).map((d) => ({
                id: d.department,
                label: d.department || 'Chưa phân phòng ban',
                subLabel: `${d.completed}/${d.totalEnrollments} hoàn thành · ${d.overdue} quá hạn`,
                value: d.completionRate,
                rightText: `${formatPercent(d.completionRate)} (TB ${formatPercent(
                  d.avgProgressPercentage,
                )})`,
              }))}
            />
          </Card>

          <DataTable
            loading={loading}
            data={completion?.byEmployee ?? []}
            rowKey={(r) => r.userId}
            emptyTitle="Không có dữ liệu tiến độ nhân sự"
            columns={[
              {
                key: 'employee',
                header: 'Nhân viên',
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.email}</p>
                  </div>
                ),
              },
              {
                key: 'dept',
                header: 'Phòng ban & Cấp bậc',
                render: (r) => (
                  <div className="text-xs">
                    <p className="font-medium text-[var(--text-primary)]">
                      {r.department || '—'}
                    </p>
                    <p className="text-[var(--text-muted)]">{r.position}</p>
                  </div>
                ),
              },
              {
                key: 'counts',
                header: 'Hoàn thành / Tổng',
                align: 'center',
                render: (r) => (
                  <span className="text-xs font-medium tabular-nums">
                    {r.completed} / {r.totalEnrollments} (Quá hạn: {r.overdue})
                  </span>
                ),
              },
              {
                key: 'avgProgress',
                header: 'Tiến độ TB',
                className: 'w-48',
                render: (r) => (
                  <ProgressBar
                    value={r.avgProgressPercentage}
                    size="sm"
                    showLabel
                  />
                ),
              },
              {
                key: 'rate',
                header: 'Tỷ lệ hoàn tất',
                align: 'right',
                render: (r) => (
                  <Badge
                    tone={
                      r.completionRate >= 80
                        ? 'success'
                        : r.overdue > 0
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {formatPercent(r.completionRate)}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Tổng số đề thi đang đánh giá"
              value={quizScores?.totalQuizzes ?? 0}
              icon={<ClipboardList className="h-4 w-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="Tổng lượt nộp bài"
              value={quizScores?.totalAttempts ?? 0}
              icon={<Users className="h-4 w-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="Điểm trung bình toàn hệ thống"
              value={formatScore(quizScores?.overallAvgScore)}
              tone="accent"
              icon={<Award className="h-4 w-4" strokeWidth={1.75} />}
            />
          </div>

          <DataTable
            loading={loading}
            data={quizScores?.quizzes ?? []}
            rowKey={(q) => q.quizId}
            emptyTitle="Chưa có dữ liệu thống kê bài kiểm tra"
            columns={[
              {
                key: 'quiz',
                header: 'Đề kiểm tra & Khóa học',
                render: (q) => (
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">
                      {q.quizTitle}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      [{q.courseCode}] {q.courseTitle} · {q.moduleTitle}
                    </p>
                  </div>
                ),
              },
              {
                key: 'passingScore',
                header: 'Điểm chuẩn',
                align: 'center',
                render: (q) => (
                  <Badge tone="info">&ge; {q.passingScore}%</Badge>
                ),
              },
              {
                key: 'attempts',
                header: 'Lượt thi / Học viên',
                align: 'center',
                render: (q) => (
                  <span className="text-xs tabular-nums">
                    {q.totalAttempts} lượt ({q.uniqueLearners} người)
                  </span>
                ),
              },
              {
                key: 'avgScore',
                header: 'Điểm TB',
                align: 'right',
                render: (q) => (
                  <span className="font-semibold tabular-nums">
                    {formatScore(q.avgScore)} / 100
                  </span>
                ),
              },
              {
                key: 'passRate',
                header: 'Tỷ lệ Đạt (>= chuẩn)',
                align: 'right',
                render: (q) => (
                  <Badge tone={q.passRate >= 70 ? 'success' : 'warning'}>
                    {formatPercent(q.passRate)}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
