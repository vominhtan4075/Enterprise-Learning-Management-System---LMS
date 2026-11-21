"use client";

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/DashboardShell';
import { fetchAdminDashboard } from '@/services/api';
import type { ActivityItem, DashboardStat } from '@/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [courseCompletion, setCourseCompletion] = useState<Array<{ name: string; value: number }>>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    fetchAdminDashboard(from || undefined, to || undefined).then((summary) => {
      setStats(summary.stats);
      setActivities(summary.activities);
      setCourseCompletion(summary.courseCompletion);
    });
  }, [from, to]);

  const displayStats = stats;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Số liệu tổng hợp đến 21/11/2026</p>
            <h2 className="mt-1 text-[22px] font-bold tracking-tight text-slate-950">Hiệu suất đào tạo toàn công ty</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700" />
            <input aria-label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700" />
            <button onClick={() => { setFrom(''); setTo(''); }} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700">Đặt lại</button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {displayStats.map((stat) => (
            <article key={stat.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
              <p className="text-[12px] font-bold text-slate-500">{stat.label}</p>
              <p className="mt-3 text-[28px] font-black tracking-tight text-slate-950">{stat.value}</p>
              <p className={`mt-3 text-[11px] font-bold ${stat.positive ? 'text-emerald-600' : 'text-rose-600'}`}>{stat.change}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.75fr)]">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sm:p-6">
            <div className="flex items-center justify-between">
              <div><h3 className="text-[15px] font-bold text-slate-950">Xu hướng hoàn thành đào tạo</h3><p className="mt-1 text-[11px] text-slate-500">Tỷ lệ hoàn thành 12 tháng gần nhất</p></div>
              <button className="rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600">2026⌄</button>
            </div>
            <div className="mt-7 flex h-[260px] gap-3">
              <div className="flex w-8 flex-col justify-between pb-7 text-right text-[10px] text-slate-400"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
              <div className="relative flex-1 border-b border-l border-slate-100 pb-7">
                {[0, 25, 50, 75].map((top) => <div key={top} className="absolute inset-x-0 border-t border-dashed border-slate-100" style={{ top: `${top}%` }} />)}
                <svg className="absolute inset-0 h-[calc(100%-28px)] w-full" viewBox="0 0 600 220" preserveAspectRatio="none" aria-label="Biểu đồ xu hướng hoàn thành">
                  <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity="0.24"/><stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/></linearGradient></defs>
                  <polygon points="0,148 55,135 109,140 164,116 218,122 273,102 327,108 382,86 436,94 491,78 545,82 600,64 600,220 0,220" fill="url(#area)"/>
                  <polyline points="0,148 55,135 109,140 164,116 218,122 273,102 327,108 382,86 436,94 491,78 545,82 600,64" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  {[0,55,109,164,218,273,327,382,436,491,545,600].map((x,index) => <circle key={index} cx={x} cy={[148,135,140,116,122,102,108,86,94,78,82,64][index]} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2"/>)}
                </svg>
                <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-slate-400">{['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'].map((month) => <span key={month}>{month}</span>)}</div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between"><div><h3 className="text-[15px] font-bold text-slate-950">Trạng thái học tập</h3><p className="mt-1 text-[11px] text-slate-500">248 nhân viên</p></div><button className="text-[11px] font-bold text-blue-600">Chi tiết</button></div>
            <div className="mt-6 flex justify-center">
              <div className="relative h-44 w-44 rounded-full" style={{ background: 'conic-gradient(#2563eb 0 68%, #22c55e 68% 88%, #f59e0b 88% 96%, #e2e8f0 96% 100%)' }}>
                <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white"><span className="text-3xl font-black text-slate-950">78%</span><span className="mt-1 text-[11px] font-bold text-slate-500">Hoàn thành</span></div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[['Đang học','168','#2563eb'],['Hoàn thành','194','#22c55e'],['Sắp đến hạn','20','#f59e0b'],['Chưa bắt đầu','10','#cbd5e1']].map(([label, value, color]) => (
                <div key={label} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }}/><div><p className="text-[11px] text-slate-500">{label}</p><p className="mt-0.5 text-sm font-black text-slate-900">{value}</p></div></div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.85fr)]">
          <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6"><div><h3 className="text-[15px] font-bold text-slate-950">Hiệu quả theo khóa học</h3><p className="mt-1 text-[11px] text-slate-500">Tỷ lệ hoàn thành</p></div><button className="text-[11px] font-bold text-blue-600">Xem tất cả</button></div>
            <div className="space-y-5 px-5 py-5 sm:px-6">{courseCompletion.length ? courseCompletion.map((item) => <div key={item.name}><div className="mb-2 flex items-center justify-between text-[12px]"><span className="font-bold text-slate-700">{item.name}</span><span className="font-black text-slate-900">{item.value}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400" style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }}/></div></div>) : <p className="py-8 text-center text-xs text-slate-400">Chưa có dữ liệu hoàn thành khóa học</p>}</div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h3 className="text-[15px] font-bold text-slate-950">Hoạt động gần đây</h3><button className="text-[11px] font-bold text-blue-600">Xem lịch sử</button></div>
            <div className="space-y-1 px-5 py-3">
              {(activities.length ? activities : []).slice(0,5).map((activity) => <div key={activity.id} className="flex gap-3 rounded-lg px-2 py-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500"/><div><p className="text-[12px] font-semibold text-slate-700">{activity.title}</p><p className="mt-0.5 text-[10px] text-slate-400">{activity.time}</p></div></div>)}
              {activities.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Chưa có hoạt động gần đây</p>}
            </div>
          </article>
        </section>
      </div>
    </DashboardShell>
  );
}
