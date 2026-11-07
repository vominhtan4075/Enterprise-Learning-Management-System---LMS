import Image from 'next/image';
import { DashboardShell } from '@/components/DashboardShell';
import { mockUser } from '@/data/mockData';

export default function ProfilePage() {
  const profileStats = [
    { label: 'Khóa học đã hoàn thành', value: '2/4', tone: 'blue' },
    { label: 'Bài Quiz đạt', value: '4', tone: 'emerald' },
    { label: 'Điểm trung bình', value: '87.5', tone: 'amber' },
    { label: 'Tỷ lệ hoàn thành', value: '50%', tone: 'cyan' },
  ];

  const skillRows = [
    { skill: 'Java Core & Spring Boot', level: 'Level 2', score: '87.5%' },
    { skill: 'PostgreSQL & REST API', level: 'Level 2', score: '85%' },
    { skill: 'Docker & Microservices', level: 'Level 1', score: '70%' },
    { skill: 'Security & CI/CD', level: 'Level 1', score: '60%' },
  ];

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-blue-100 bg-slate-100 shadow-sm">
                <Image
                  src={mockUser.avatar}
                  alt={mockUser.name}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Tài khoản nhân sự</p>
                <h1 className="mt-2 text-3xl font-black text-slate-900">{mockUser.name}</h1>
                <p className="mt-1 text-sm text-slate-500">{mockUser.role} • {mockUser.department}</p>
              </div>
            </div>

            <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700">
              Cập nhật profile
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {profileStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
              <p className={`mt-4 text-3xl font-black ${stat.tone === 'blue' ? 'text-blue-600' : stat.tone === 'emerald' ? 'text-emerald-600' : stat.tone === 'amber' ? 'text-amber-600' : 'text-cyan-600'}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-medium text-slate-500">Email</span>
                <span className="font-semibold text-slate-800">{mockUser.email}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-medium text-slate-500">Số điện thoại</span>
                <span className="font-semibold text-slate-800">+84 912 345 678</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="font-medium text-slate-500">Phòng ban</span>
                <span className="font-semibold text-slate-800">{mockUser.department}</span>
              </div>
              <div className="flex items-center justify-between pb-1">
                <span className="font-medium text-slate-500">Mã nhân sự</span>
                <span className="font-semibold text-slate-800">NV-002</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Đánh giá kỹ năng cá nhân</h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                Đạt chuẩn
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {skillRows.map((skill) => (
                <div key={skill.skill} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{skill.skill}</p>
                      <p className="text-[11px] text-slate-500">{skill.level}</p>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{skill.score}</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500"
                      style={{ width: skill.score }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
