"use client";

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { exportCompetencyMatrix, fetchCompetencyMatrix } from '@/services/api';
import type { CompetencyEmployeeRow } from '@/types';

const skillColumns = ['Java Core', 'Spring Boot', 'Database', 'REST API', 'Docker'];

export default function CompetencyPage() {
  const [department, setDepartment] = useState('Tất cả phòng ban');
  const [level, setLevel] = useState('Tất cả cấp bậc');
  const [exported, setExported] = useState(false);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<CompetencyEmployeeRow[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const employeeData = await fetchCompetencyMatrix(department, level);
      setEmployees(employeeData);
      setLoading(false);
    }

    loadData();
  }, [department, level]);

  const filteredEmployees = employees.filter((employee) =>
    (department === 'Tất cả phòng ban' || employee.department === department) &&
    (level === 'Tất cả cấp bậc' || employee.role === level)
  );

  const average = Math.round(filteredEmployees.reduce((sum, employee) => sum + employee.scores.reduce((a,b) => a+b,0) / employee.scores.length, 0) / Math.max(filteredEmployees.length,1));

  const excellentCount = filteredEmployees.filter((employee) => employee.status === 'Xuất sắc').length;
  const supportCount = filteredEmployees.filter((employee) => employee.status === 'Cần hỗ trợ').length;
  const standardCount = filteredEmployees.filter((employee) => employee.status === 'Đạt chuẩn').length;
  const distribution = [
    ['Xuất sắc · 85–100', excellentCount, 'bg-emerald-500'],
    ['Đạt chuẩn · 70–84', standardCount, 'bg-blue-500'],
    ['Cần cải thiện · 60–69', supportCount, 'bg-amber-500'],
  ] as const;

  const skillPriority = skillColumns.map((name, index) => {
    const scores = filteredEmployees.map((employee) => employee.scores[index]).filter((score) => Number.isFinite(score));
    const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    return [name, score] as const;
  }).sort((a, b) => a[1] - b[1]).slice(0, 3);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm text-slate-500">Phân tích năng lực từ kết quả quiz và khóa học</p><h2 className="mt-1 text-[22px] font-bold tracking-tight text-slate-950">Báo cáo ma trận năng lực</h2></div>
          <button onClick={async () => { await exportCompetencyMatrix(filteredEmployees, department, level); setExported(true); window.setTimeout(() => setExported(false), 2200); }} className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm">{exported ? '✓ Đã tạo tệp' : '↓ Xuất Excel'}</button>
        </section>

        <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-[11px] font-bold text-slate-500">Phòng ban
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500"><option>Tất cả phòng ban</option><option>Engineering</option><option>Data</option></select>
          </label>
          <label className="text-[11px] font-bold text-slate-500">Cấp bậc
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-500"><option>Tất cả cấp bậc</option><option>Fresher</option><option>Junior</option><option>Senior</option></select>
          </label>
          <label className="text-[11px] font-bold text-slate-500">Kỳ đánh giá
            <select className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"><option>Quý IV / 2026</option><option>Quý III / 2026</option></select>
          </label>
          <label className="text-[11px] font-bold text-slate-500">Trạng thái
            <select className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none"><option>Tất cả trạng thái</option><option>Đạt chuẩn</option><option>Cần hỗ trợ</option></select>
          </label>
          <div className="flex items-end"><button onClick={() => { setDepartment('Tất cả phòng ban'); setLevel('Tất cả cấp bậc'); }} className="h-10 w-full rounded-lg bg-slate-900 text-xs font-bold text-white">Đặt lại bộ lọc</button></div>
        </section>

        {loading ? (
          <div className="flex justify-center py-10">
            <svg className="h-8 w-8 animate-spin text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4zm16 0a8 8 0 01-8 8v-8h8z"></path>
            </svg>
          </div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[['Nhân sự đánh giá',filteredEmployees.length.toString(),'Trong bộ lọc hiện tại'],['Điểm trung bình',`${average}/100`,'Điểm trung bình ma trận'],['Đạt yêu cầu',`${filteredEmployees.length ? Math.round((excellentCount + standardCount) / filteredEmployees.length * 100) : 0}%`,'Xuất sắc hoặc đạt chuẩn'],['Cần hỗ trợ',supportCount.toString(),'Nhân sự cần coaching']].map(([label,value,note],index) => (
                <article key={label} className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-[12px] font-bold text-slate-500">{label}</p><p className="mt-3 text-[28px] font-black text-slate-950">{value}</p><p className={`mt-2 text-[11px] font-bold ${index === 3 ? 'text-amber-600' : 'text-emerald-600'}`}>{note}</p></article>
              ))}
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h3 className="text-[15px] font-bold text-slate-950">Ma trận nhân viên – kỹ năng</h3><p className="mt-1 text-[11px] text-slate-500">Điểm năng lực theo thang 100</p></div><div className="hidden gap-3 text-[10px] text-slate-500 sm:flex"><span>● Mạnh</span><span>● Trung bình</span><span>● Yếu</span></div></div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left">
                    <thead><tr className="border-b border-slate-100 bg-slate-50/70"><th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Nhân sự</th>{skillColumns.map((skill) => <th key={skill} className="px-2 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">{skill}</th>)}<th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading && <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-400">Đang tải ma trận năng lực...</td></tr>}
                      {!loading && filteredEmployees.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-xs text-slate-400">Chưa có dữ liệu ma trận năng lực từ API</td></tr>}
                      {!loading && filteredEmployees.map((employee) => (
                        <tr key={employee.name} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3"><p className="text-[12px] font-bold text-slate-800">{employee.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{employee.role} • {employee.department}</p></td>
                          {employee.scores.map((score, index) => <td key={index} className="px-2 py-3 text-center"><span className={`inline-flex h-8 min-w-10 items-center justify-center rounded-md text-[11px] font-black ${scoreColor(score)}`}>{score}</span></td>)}
                          <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${employee.status === 'Xuất sắc' ? 'bg-emerald-100 text-emerald-700' : employee.status === 'Đạt chuẩn' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{employee.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-5">
                <div><h3 className="text-[15px] font-bold text-slate-950">Phân bố mức năng lực</h3><p className="mt-1 text-[11px] text-slate-500">Theo điểm trung bình toàn kỹ năng</p></div>
                <div className="mt-6 space-y-4">
                  {distribution.map(([label,value,color]) => (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-semibold text-slate-600">{label}</span><span className="font-black text-slate-900">{value}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${filteredEmployees.length ? value / filteredEmployees.length * 100 : 0}%` }}/></div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 border-t border-slate-100 pt-5">
                  <p className="text-[11px] font-bold text-slate-500">Kỹ năng cần ưu tiên</p>
                  <div className="mt-3 space-y-2">{skillPriority.map(([name,score]) => <div key={name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span className="text-[11px] font-bold text-slate-700">{name}</span><span className={`rounded-md px-2 py-1 text-[10px] font-black text-white ${score >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}>{score}%</span></div>)}</div>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

function scoreColor(score: number) {
  if (score >= 85) return 'bg-emerald-100 text-emerald-800';
  if (score >= 70) return 'bg-blue-100 text-blue-800';
  if (score >= 60) return 'bg-amber-100 text-amber-800';
  return 'bg-rose-100 text-rose-800';
}
