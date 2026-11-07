import { DashboardShell } from '@/components/DashboardShell';
import { mockCompetencySkills, mockUser } from '@/data/mockData';

export default function CompetencyPage() {
  const avgScore = (
    mockCompetencySkills.reduce((sum, s) => sum + s.score, 0) / mockCompetencySkills.length
  ).toFixed(1);

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Banner Tổng quan Ma trận năng lực */}
        <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-8 text-white shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-block rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300 border border-blue-500/30">
                Đề tài DT02 • Khung Năng Lực Chuẩn Hóa
              </span>
              <h1 className="text-3xl font-black">Ma Trận Năng Lực Kỹ Thuật (Competency Matrix)</h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Được tổng hợp tự động từ kết quả bài kiểm tra trắc nghiệm kết thúc học phần và đánh giá thực hành của nhân sự {mockUser.name} ({mockUser.department}).
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shrink-0 text-center md:text-right">
              <p className="text-xs uppercase font-bold text-slate-400">Điểm năng lực tổng thể</p>
              <p className="text-4xl font-black text-cyan-400 mt-1">{avgScore} / 100</p>
              <p className="text-xs text-emerald-400 font-semibold mt-1">✓ Đạt chuẩn Fresher Backend</p>
            </div>
          </div>
        </div>

        {/* Danh sách kỹ năng theo thẻ năng lực */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Chi Tiết Năng Lực Từng Chuyên Mục</h2>
            <span className="text-xs text-slate-500">Quy tắc đánh giá: Đạt chuẩn khi điểm $\ge 70\%$</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mockCompetencySkills.map((item) => (
              <div
                key={item.skill}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3 flex flex-col justify-between hover:shadow-md transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                      {item.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.score >= 70
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-slate-900 leading-snug">{item.skill}</h3>
                  <p className="mt-1 text-xs text-slate-400">{item.level}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>Mức độ thành thạo</span>
                    <span className={item.score >= 70 ? 'text-blue-600' : 'text-amber-600'}>
                      {item.score}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        item.score >= 70
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bảng tổng hợp chi tiết theo chuẩn HRM */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Bảng Tổng Hợp Đồng Bộ Với Hệ Thống Nhân Sự HRM</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-900 uppercase font-bold text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Kỹ năng chuyên môn</th>
                  <th className="py-3 px-4">Nhóm danh mục</th>
                  <th className="py-3 px-4">Điểm số</th>
                  <th className="py-3 px-4">Cấp bậc năng lực</th>
                  <th className="py-3 px-4">Trạng thái nghiệm thu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mockCompetencySkills.map((s) => (
                  <tr key={s.skill} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{s.skill}</td>
                    <td className="py-3 px-4 text-slate-500">{s.category}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-600">{s.score} / 100</td>
                    <td className="py-3 px-4 text-slate-600">{s.level}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          s.score >= 70
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
