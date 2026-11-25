'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Award, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  POSITION_LABELS,
  POSITION_LEVELS,
  formatPercent,
  formatScore,
} from '@/lib/formatters';
import { learningPathsService } from '@/services/learning-paths.service';
import { reportsService } from '@/services/reports.service';
import type {
  CompetencyMatrixResponse,
  LearningPathSummary,
  PositionLevel,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui/primitives';

export default function CompetencyMatrixPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();

  const [matrixData, setMatrixData] = useState<
    CompetencyMatrixResponse['data'] | null
  >(null);
  const [paths, setPaths] = useState<LearningPathSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState<PositionLevel | ''>('');
  const [learningPathId, setLearningPathId] = useState('');

  const canRecalculate = user?.role === 'ADMIN' || user?.role === 'HR';

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportsService.getCompetencyMatrix({
        department: department.trim() || undefined,
        position: position || undefined,
        learningPathId: learningPathId || undefined,
      });
      setMatrixData(res.data);
    } catch (err) {
      showError(
        'Không thể tải Ma trận năng lực',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [department, position, learningPathId, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchMatrix();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchMatrix]);

  useEffect(() => {
    learningPathsService
      .getAll()
      .then((res) => setPaths(res))
      .catch(() => setPaths([]));
  }, []);

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const blob = await reportsService.exportCompetencyExcel({
        department: department.trim() || undefined,
        position: position || undefined,
        learningPathId: learningPathId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `novatech-competency-matrix-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      success('Đã tải xuống báo cáo Excel Ma trận năng lực.');
    } catch (err) {
      showError(
        'Xuất Excel thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setExporting(false);
    }
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await reportsService.recalculateCompetency();
      success(
        'Đã tính toán lại Ma trận năng lực',
        `Đã xử lý ${res.processedUsers} nhân sự và cập nhật ${res.updatedRecords} bản ghi kỹ năng.`,
      );
      await fetchMatrix();
    } catch (err) {
      showError(
        'Không thể tính toán lại năng lực',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setRecalculating(false);
    }
  };

  const skills = matrixData?.skills ?? [];
  const employees = matrixData?.employees ?? [];
  const positionSummary = matrixData?.positionSummary ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ma trận năng lực nhân sự"
        description="Đối chiếu điểm đánh giá thực tế từng kỹ năng của nhân sự với ngưỡng chuẩn yêu cầu theo cấp bậc vị trí công việc."
        secondaryAction={
          canRecalculate ? (
            <Button
              variant="secondary"
              loading={recalculating}
              onClick={handleRecalculate}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
            >
              Đồng bộ lại điểm
            </Button>
          ) : undefined
        }
        action={
          <Button
            loading={exporting}
            onClick={handleExportExcel}
            leftIcon={<Download className="h-4 w-4" strokeWidth={1.75} />}
          >
            Xuất báo cáo Excel (.xlsx)
          </Button>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-3">
        <Input
          placeholder="Lọc theo phòng ban..."
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
        <Select
          value={position}
          onChange={(e) => setPosition(e.target.value as PositionLevel | '')}
          options={[
            { value: '', label: 'Tất cả vị trí cấp bậc' },
            ...POSITION_LEVELS.map((lvl) => ({
              value: lvl,
              label: POSITION_LABELS[lvl],
            })),
          ]}
        />
        <Select
          value={learningPathId}
          onChange={(e) => setLearningPathId(e.target.value)}
          options={[
            { value: '', label: 'Tất cả lộ trình đào tạo' },
            ...paths.map((p) => ({
              value: p.id,
              label: p.title,
            })),
          ]}
        />
      </div>

      {/* 5-Position Benchmark Summary */}
      {positionSummary.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
          {positionSummary.map((row) => (
            <div
              key={row.position}
              className="rounded-lg border border-[var(--border-default)] bg-white p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--accent)]">
                  {row.position}
                </span>
                <Badge tone="neutral">Chuẩn {row.requiredScore}</Badge>
              </div>
              <p className="text-xl font-semibold text-[var(--text-primary)] tabular-nums">
                TB {formatScore(row.avgProficiencyScore)}
              </p>
              <div className="text-xs text-[var(--text-secondary)] space-y-0.5 tabular-nums">
                <p>
                  Nhân sự: {row.assessedEmployees}/{row.totalEmployees} đã đánh
                  giá
                </p>
                <p>
                  Tỷ lệ kỹ năng đạt:{' '}
                  <strong className="text-emerald-700">
                    {formatPercent(row.passedRate)}
                  </strong>{' '}
                  · GAP: <strong className="text-rose-700">{row.gapSkillCount}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dynamic Skill Heatmap Table */}
      <Card
        title={`Bảng Ma trận Kỹ năng Chi tiết (${employees.length} nhân sự)`}
        subtitle="Ô màu xanh thể hiện đạt chuẩn cấp bậc (PASSED); ô hồng nhạt cảnh báo thiếu hụt kỹ năng cần đào tạo bù (GAP)."
        bodyClassName="p-0"
      >
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Award className="h-5 w-5" strokeWidth={1.75} />}
              title="Chưa có dữ liệu năng lực phù hợp bộ lọc"
              description="Điểm ma trận năng lực sẽ tự động ghi nhận khi nhân sự nộp các bài kiểm tra Quiz gắn nhãn kỹ năng."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Nhân sự
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Cấp bậc
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                    Điểm TB
                  </th>
                  {skills.map((skill) => (
                    <th
                      key={skill}
                      className="px-3.5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)] min-w-[130px]"
                    >
                      {skill}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-default)]">
                {employees.map((emp) => {
                  const skillMap = new Map(
                    emp.competencies.map((c) => [c.skillName, c]),
                  );
                  return (
                    <tr
                      key={emp.userId}
                      className="hover:bg-[var(--bg-subtle)]/50"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-[var(--text-primary)]">
                          {emp.fullName}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {emp.department || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone="accent">{emp.position}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                        {formatScore(emp.avgScore)}
                      </td>
                      {skills.map((sk) => {
                        const cell = skillMap.get(sk);
                        if (!cell || cell.status === 'NOT_ASSESSED') {
                          return (
                            <td
                              key={sk}
                              className="px-3.5 py-3.5 text-center text-xs text-slate-400"
                            >
                              —
                            </td>
                          );
                        }
                        const passed = cell.status === 'PASSED';
                        return (
                          <td key={sk} className="px-3.5 py-3.5 text-center">
                            <span
                              className={`inline-flex flex-col items-center rounded border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                                passed
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                  : 'border-rose-200 bg-rose-50 text-rose-900'
                              }`}
                            >
                              <span>{formatScore(cell.score)}</span>
                              <span className="text-[10px] font-normal opacity-80">
                                {passed
                                  ? 'Đạt'
                                  : `Thiếu ${Math.abs(
                                      Math.round(
                                        (cell.requiredScore - cell.score) * 10,
                                      ) / 10,
                                    )}`}
                              </span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
