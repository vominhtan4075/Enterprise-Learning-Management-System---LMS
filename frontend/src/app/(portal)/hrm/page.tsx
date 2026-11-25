'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  HRM_SYNC_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatScore,
} from '@/lib/formatters';
import { hrmService } from '@/services/hrm.service';
import type {
  HrmMockEmployee,
  HrmSyncLogItem,
  HrmSyncResponse,
  HrmSyncStatus,
  HrmTrainingStatusItem,
  PaginatedResponse,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  Select,
  Tabs,
} from '@/components/ui/primitives';
import { Drawer } from '@/components/ui/overlays';
import { DataTable } from '@/components/ui/data-table';

type HrmTab = 'EMPLOYEES' | 'LOGS' | 'TRAINING_STATUS';

export default function HrmIntegrationPortalPage() {
  const { success, error: showError } = useToast();

  const [tab, setTab] = useState<HrmTab>('EMPLOYEES');

  // Tab 1: Mock Employees & Sync
  const [mockEmployees, setMockEmployees] = useState<HrmMockEmployee[]>([]);
  const [loadingMock, setLoadingMock] = useState(true);
  const [empStatusFilter, setEmpStatusFilter] = useState<
    '' | 'ACTIVE' | 'RESIGNED'
  >('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<HrmSyncResponse | null>(
    null,
  );

  // Tab 2: Sync Logs
  const [logs, setLogs] = useState<PaginatedResponse<HrmSyncLogItem> | null>(
    null,
  );
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logStatus, setLogStatus] = useState<HrmSyncStatus | ''>('');
  const [logSearch, setLogSearch] = useState('');
  const [detailLog, setDetailLog] = useState<HrmSyncLogItem | null>(null);

  // Tab 3: Training Status Feed back to HRM
  const [trainingStatus, setTrainingStatus] =
    useState<PaginatedResponse<HrmTrainingStatusItem> | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusPage, setStatusPage] = useState(1);
  const [statusDept, setStatusDept] = useState('');

  const fetchMockEmployees = useCallback(async () => {
    setLoadingMock(true);
    try {
      const list = await hrmService.getMockEmployees({
        department: empDeptFilter.trim() || undefined,
        status: empStatusFilter || undefined,
      });
      setMockEmployees(list);
    } catch (err) {
      showError(
        'Không thể tải danh sách nguồn nhân sự HRM',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoadingMock(false);
    }
  }, [empDeptFilter, empStatusFilter, showError]);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await hrmService.getSyncLogs({
        page: logPage,
        limit: 15,
        status: logStatus || undefined,
        search: logSearch.trim() || undefined,
      });
      setLogs(res);
    } catch (err) {
      showError(
        'Không thể tải nhật ký đồng bộ',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoadingLogs(false);
    }
  }, [logPage, logStatus, logSearch, showError]);

  const fetchTrainingStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await hrmService.getTrainingStatus({
        page: statusPage,
        limit: 15,
        department: statusDept.trim() || undefined,
      });
      setTrainingStatus(res);
    } catch (err) {
      showError(
        'Không thể tải trạng thái đào tạo hoàn trả HRM',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoadingStatus(false);
    }
  }, [statusPage, statusDept, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tab === 'EMPLOYEES') void fetchMockEmployees();
      if (tab === 'LOGS') void fetchLogs();
      if (tab === 'TRAINING_STATUS') void fetchTrainingStatus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [tab, fetchMockEmployees, fetchLogs, fetchTrainingStatus]);

  const handleSyncEmployees = async (onlySelected: boolean) => {
    const targetList = onlySelected
      ? mockEmployees.filter((e) => selectedCodes.includes(e.employeeCode))
      : mockEmployees;

    if (targetList.length === 0) {
      showError('Vui lòng chọn ít nhất 1 nhân sự để đồng bộ.');
      return;
    }

    setSyncing(true);
    try {
      const res = await hrmService.syncUsers({ employees: targetList });
      setLastSyncResult(res);
      const sum = res.data.summary;
      success(
        `Đã xử lý đồng bộ ${sum.totalProcessed} nhân sự`,
        `Tạo mới: ${sum.createdCount} · Cập nhật: ${sum.updatedCount} · Đổi vị trí: ${sum.positionChangedCount} · Vô hiệu: ${sum.deactivatedCount}`,
      );
      setSelectedCodes([]);
    } catch (err) {
      showError(
        'Đồng bộ HRM thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenLogDetail = async (id: string) => {
    try {
      const detail = await hrmService.getSyncLogDetail(id);
      setDetailLog(detail);
    } catch (err) {
      showError(
        'Không thể tải chi tiết log',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cổng Tích hợp Nhân sự HRM"
        description="Đồng bộ tự động danh sách nhân sự từ hệ thống HRM sang LMS, tự động gán lộ trình Onboarding và hoàn trả kết quả đào tạo."
        action={
          tab === 'EMPLOYEES' ? (
            <Button
              loading={syncing}
              onClick={() => handleSyncEmployees(selectedCodes.length > 0)}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={1.75} />}
            >
              {selectedCodes.length > 0
                ? `Đồng bộ ${selectedCodes.length} nhân sự đã chọn`
                : 'Đồng bộ toàn bộ danh sách HRM'}
            </Button>
          ) : undefined
        }
      />

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'EMPLOYEES', label: 'Nguồn nhân sự HRM & Đồng bộ' },
          { key: 'LOGS', label: 'Nhật ký đồng bộ (Sync Logs)' },
          { key: 'TRAINING_STATUS', label: 'Dữ liệu hoàn trả HRM' },
        ]}
      />

      {tab === 'EMPLOYEES' && (
        <div className="space-y-5">
          {lastSyncResult && (
            <Card
              tinted
              title="Kết quả phiên đồng bộ gần nhất"
              subtitle={lastSyncResult.message}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 text-center text-xs">
                <div className="rounded border border-[var(--border-default)] bg-white p-2.5">
                  <p className="text-[var(--text-muted)]">Tổng xử lý</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {lastSyncResult.data.summary.totalProcessed}
                  </p>
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50 p-2.5">
                  <p className="text-emerald-800">Tạo mới</p>
                  <p className="mt-1 text-base font-semibold text-emerald-900 tabular-nums">
                    {lastSyncResult.data.summary.createdCount}
                  </p>
                </div>
                <div className="rounded border border-sky-200 bg-sky-50 p-2.5">
                  <p className="text-sky-800">Cập nhật</p>
                  <p className="mt-1 text-base font-semibold text-sky-900 tabular-nums">
                    {lastSyncResult.data.summary.updatedCount}
                  </p>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 p-2.5">
                  <p className="text-amber-800">Đổi cấp bậc</p>
                  <p className="mt-1 text-base font-semibold text-amber-900 tabular-nums">
                    {lastSyncResult.data.summary.positionChangedCount}
                  </p>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
                  <p className="text-slate-700">Ngừng kích hoạt</p>
                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {lastSyncResult.data.summary.deactivatedCount}
                  </p>
                </div>
                <div className="rounded border border-rose-200 bg-rose-50 p-2.5">
                  <p className="text-rose-800">Bỏ qua / Lỗi</p>
                  <p className="mt-1 text-base font-semibold text-rose-900 tabular-nums">
                    {lastSyncResult.data.summary.skippedCount +
                      lastSyncResult.data.summary.failedCount}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-2">
            <Input
              placeholder="Lọc phòng ban nguồn HRM..."
              value={empDeptFilter}
              onChange={(e) => setEmpDeptFilter(e.target.value)}
            />
            <Select
              value={empStatusFilter}
              onChange={(e) =>
                setEmpStatusFilter(e.target.value as '' | 'ACTIVE' | 'RESIGNED')
              }
              options={[
                { value: '', label: 'Tất cả trạng thái làm việc' },
                { value: 'ACTIVE', label: 'Đang làm việc (ACTIVE)' },
                { value: 'RESIGNED', label: 'Đã nghỉ việc (RESIGNED)' },
              ]}
            />
          </div>

          <DataTable
            loading={loadingMock}
            data={mockEmployees}
            rowKey={(r) => r.employeeCode}
            emptyTitle="Không có nhân sự nào từ nguồn HRM"
            columns={[
              {
                key: 'select',
                header: 'Chọn',
                className: 'w-12',
                render: (r) => (
                  <input
                    type="checkbox"
                    checked={selectedCodes.includes(r.employeeCode)}
                    onChange={(e) =>
                      setSelectedCodes((prev) =>
                        e.target.checked
                          ? [...prev, r.employeeCode]
                          : prev.filter((c) => c !== r.employeeCode),
                      )
                    }
                    className="accent-[var(--accent)] cursor-pointer"
                  />
                ),
              },
              {
                key: 'code',
                header: 'Mã NV',
                render: (r) => (
                  <span className="font-mono text-xs font-semibold">
                    {r.employeeCode}
                  </span>
                ),
              },
              {
                key: 'name',
                header: 'Họ tên & Email',
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-xs text-[var(--text-muted)]">{r.email}</p>
                  </div>
                ),
              },
              {
                key: 'position',
                header: 'Chức danh HRM & Phòng ban',
                render: (r) => (
                  <div className="text-xs">
                    <p className="font-medium">{r.position}</p>
                    <p className="text-[var(--text-muted)]">{r.department}</p>
                  </div>
                ),
              },
              {
                key: 'startDate',
                header: 'Ngày vào làm',
                align: 'center',
                render: (r) => (
                  <span className="text-xs">{formatDate(r.startDate)}</span>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái HRM',
                align: 'right',
                render: (r) => (
                  <Badge
                    tone={
                      r.employmentStatus === 'ACTIVE' ? 'success' : 'neutral'
                    }
                  >
                    {r.employmentStatus}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'LOGS' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-2">
            <Input
              placeholder="Tìm mã nhân viên hoặc email..."
              value={logSearch}
              onChange={(e) => {
                setLogPage(1);
                setLogSearch(e.target.value);
              }}
            />
            <Select
              value={logStatus}
              onChange={(e) => {
                setLogPage(1);
                setLogStatus(e.target.value as HrmSyncStatus | '');
              }}
              options={[
                { value: '', label: 'Mọi trạng thái đồng bộ' },
                { value: 'INITIATED', label: 'Đã đồng bộ (INITIATED)' },
                { value: 'SKIPPED', label: 'Bỏ qua (SKIPPED)' },
                { value: 'FAILED', label: 'Thất bại (FAILED)' },
              ]}
            />
          </div>

          <DataTable
            loading={loadingLogs}
            data={logs?.data ?? []}
            rowKey={(r) => r.id}
            page={logs?.page}
            totalPages={logs?.totalPages}
            total={logs?.total}
            onPageChange={setLogPage}
            emptyTitle="Chưa có nhật ký đồng bộ HRM"
            columns={[
              {
                key: 'employeeCode',
                header: 'Mã NV / Email',
                render: (r) => (
                  <div>
                    <p className="font-mono text-xs font-semibold">
                      {r.employeeCode}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">{r.email}</p>
                  </div>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                align: 'center',
                render: (r) => (
                  <Badge
                    tone={
                      r.status === 'INITIATED'
                        ? 'success'
                        : r.status === 'FAILED'
                          ? 'danger'
                          : 'warning'
                    }
                  >
                    {HRM_SYNC_STATUS_LABELS[r.status]}
                  </Badge>
                ),
              },
              {
                key: 'message',
                header: 'Ghi chú xử lý',
                render: (r) => (
                  <span className="text-xs text-[var(--text-secondary)]">
                    {r.message || 'Đồng bộ hợp lệ'}
                  </span>
                ),
              },
              {
                key: 'createdAt',
                header: 'Thời gian',
                align: 'right',
                render: (r) => (
                  <span className="text-xs">{formatDateTime(r.createdAt)}</span>
                ),
              },
              {
                key: 'detail',
                header: 'Payload',
                align: 'right',
                render: (r) => (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleOpenLogDetail(r.id)}
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Chi tiết
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      {tab === 'TRAINING_STATUS' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border-default)] bg-white p-4 max-w-sm">
            <Input
              placeholder="Lọc theo phòng ban..."
              value={statusDept}
              onChange={(e) => {
                setStatusPage(1);
                setStatusDept(e.target.value);
              }}
            />
          </div>

          <DataTable
            loading={loadingStatus}
            data={trainingStatus?.data ?? []}
            rowKey={(r) => r.userId}
            page={trainingStatus?.page}
            totalPages={trainingStatus?.totalPages}
            total={trainingStatus?.total}
            onPageChange={setStatusPage}
            emptyTitle="Chưa có dữ liệu đối soát đào tạo"
            columns={[
              {
                key: 'emp',
                header: 'Nhân sự',
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.fullName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {r.employeeCode || 'Nội bộ'} · {r.email}
                    </p>
                  </div>
                ),
              },
              {
                key: 'dept',
                header: 'Phòng ban & Cấp bậc',
                render: (r) => (
                  <div className="text-xs">
                    <p className="font-medium">{r.department || '—'}</p>
                    <p className="text-[var(--text-muted)]">{r.position}</p>
                  </div>
                ),
              },
              {
                key: 'progress',
                header: 'Tiến độ tổng hợp',
                className: 'w-48',
                render: (r) => (
                  <ProgressBar
                    value={r.overallProgressPercentage}
                    size="sm"
                    showLabel
                  />
                ),
              },
              {
                key: 'competency',
                header: 'Điểm Năng lực TB',
                align: 'right',
                render: (r) => (
                  <span className="font-semibold tabular-nums">
                    {formatScore(r.avgCompetencyScore)}
                  </span>
                ),
              },
              {
                key: 'overallStatus',
                header: 'Trạng thái tổng thể',
                align: 'right',
                render: (r) => (
                  <Badge
                    tone={
                      r.overallStatus === 'COMPLETED'
                        ? 'success'
                        : r.overallStatus === 'OVERDUE'
                          ? 'danger'
                          : 'info'
                    }
                  >
                    {r.overallStatus}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Sync Log Payload Drawer */}
      <Drawer
        open={Boolean(detailLog)}
        onClose={() => setDetailLog(null)}
        title={`Chi tiết bản ghi đồng bộ: ${detailLog?.employeeCode || ''}`}
        subtitle={detailLog ? formatDateTime(detailLog.createdAt) : ''}
      >
        {detailLog && (
          <div className="space-y-4 text-xs">
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 space-y-1">
              <p>
                <strong>Email:</strong> {detailLog.email}
              </p>
              <p>
                <strong>Trạng thái:</strong>{' '}
                {HRM_SYNC_STATUS_LABELS[detailLog.status]}
              </p>
              <p>
                <strong>Thông điệp:</strong> {detailLog.message || '—'}
              </p>
            </div>
            <div>
              <p className="mb-1.5 font-semibold text-[var(--text-secondary)]">
                Raw JSON Payload từ HRM:
              </p>
              <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                {JSON.stringify(detailLog.payload ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
