"use client";

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import {
  fetchHrmEmployees,
  fetchHrmSyncHistory,
  fetchHrmSyncHistoryDetail,
  syncHrmUsers,
} from '@/services/api';
import type { HrmSyncHistoryItem } from '@/types';

interface HrmEmployee {
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  startDate?: string;
}

export default function HrmSyncHistoryPage() {
  const [employees, setEmployees] = useState<HrmEmployee[]>([]);
  const [history, setHistory] = useState<HrmSyncHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<HrmSyncHistoryItem | null>(null);

  async function loadHistory(nextPage = page) {
    setLoading(true);
    setError('');
    const result = await fetchHrmSyncHistory(nextPage, 20, status || undefined, search.trim() || undefined);
    setHistory(result.data);
    setTotalPages(result.totalPages);
    setPage(result.page);
    setLoading(false);
  }

  useEffect(() => {
    fetchHrmEmployees().then((items) => setEmployees(items as HrmEmployee[]));
  }, []);

  useEffect(() => {
    loadHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-hooks
  }, [status]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    try {
      await syncHrmUsers({ employees });
      await loadHistory(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể đồng bộ HRM.');
    } finally {
      setSyncing(false);
    }
  }

  async function openDetail(id: string) {
    setDetail(await fetchHrmSyncHistoryDetail(id));
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Theo dõi kết quả đồng bộ dữ liệu nhân sự</p>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-slate-950">Lịch sử đồng bộ HRM</h2>
          </div>
          <button
            disabled={syncing || employees.length === 0}
            onClick={handleSync}
            className="h-10 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? 'Đang đồng bộ...' : '↻ Đồng bộ HRM'}
          </button>
        </section>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{error}</div>}

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_180px_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') loadHistory(1); }}
            placeholder="Tìm theo mã nhân viên hoặc email"
            className="h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-blue-500"
          />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="INITIATED">Thành công</option>
            <option value="SKIPPED">Bỏ qua</option>
            <option value="FAILED">Thất bại</option>
          </select>
          <button onClick={() => loadHistory(1)} className="h-10 rounded-lg bg-slate-900 px-4 text-xs font-bold text-white">Tìm kiếm</button>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70"><th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Thời gian</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Nhân viên</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Mã nhân viên</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Trạng thái</th><th className="px-5 py-3 text-[10px] font-bold uppercase text-slate-500">Chi tiết</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loading && <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400">Đang tải lịch sử đồng bộ...</td></tr>}
                {!loading && history.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400">Chưa có lịch sử đồng bộ HRM</td></tr>}
                {!loading && history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3 text-xs text-slate-600">{new Date(item.createdAt).toLocaleString('vi-VN')}</td>
                    <td className="px-5 py-3"><p className="text-xs font-bold text-slate-800">{item.email}</p><p className="mt-1 max-w-xs truncate text-[10px] text-slate-400">{item.message ?? 'Không có ghi chú'}</p></td>
                    <td className="px-5 py-3 text-xs font-semibold text-slate-700">{item.employeeCode}</td>
                    <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === 'INITIATED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{item.status === 'INITIATED' ? 'Thành công' : item.status === 'FAILED' ? 'Thất bại' : 'Bỏ qua'}</span></td>
                    <td className="px-5 py-3"><button onClick={() => openDetail(item.id)} className="text-xs font-bold text-blue-600">Xem chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3"><button disabled={page <= 1} onClick={() => loadHistory(page - 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Trước</button><span className="text-xs text-slate-500">{page}/{totalPages}</span><button disabled={page >= totalPages} onClick={() => loadHistory(page + 1)} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40">Sau</button></div>}
        </section>

        {detail && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setDetail(null)}><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h3 className="text-base font-bold text-slate-900">Chi tiết đồng bộ HRM</h3><button onClick={() => setDetail(null)} className="text-slate-400">Đóng</button></div><div className="mt-4 space-y-3 text-xs"><p><b>Mã nhân viên:</b> {detail.employeeCode}</p><p><b>Email:</b> {detail.email}</p><p><b>Trạng thái:</b> {detail.status}</p><p><b>Thông báo:</b> {detail.message ?? 'Không có'}</p><p><b>User ID:</b> {detail.userId ?? 'Không tạo/cập nhật'}</p><p><b>Lộ trình:</b> {detail.assignedPathId ?? 'Chưa gán'}</p><pre className="max-h-48 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-200">{JSON.stringify(detail.payload, null, 2)}</pre></div></div></div>}
      </div>
    </DashboardShell>
  );
}
