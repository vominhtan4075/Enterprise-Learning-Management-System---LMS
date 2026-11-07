import { ActivityList } from '@/components/ActivityList';
import { CourseList } from '@/components/CourseList';
import { DashboardShell } from '@/components/DashboardShell';
import { StatCard } from '@/components/StatCard';
import { mockActivities, mockCourses, mockStats } from '@/data/mockData';

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="space-y-8">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {mockStats.map((stat) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              positive={stat.positive}
            />
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
          <CourseList courses={mockCourses} />
          <ActivityList activities={mockActivities} />
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h3 className="text-lg font-semibold text-slate-900">Tiến độ đào tạo</h3>
            <div className="mt-6 space-y-5">
              {[
                { label: 'Leadership Essentials', value: 72 },
                { label: 'Data Analytics for Teams', value: 45 },
                { label: 'Cybersecurity Basics', value: 100 },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                    <span>{item.label}</span>
                    <span>{item.value}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${item.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Lịch học tuần này</h3>
            <div className="mt-5 space-y-4">
              {[
                { day: 'Thứ 2', title: 'Workshop: Leadership' },
                { day: 'Thứ 4', title: 'Quiz: Safety Training' },
                { day: 'Thứ 6', title: 'Mentor session' },
              ].map((item) => (
                <div key={item.day} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.day}</p>
                    <p className="text-xs text-slate-500">{item.title}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">9:00</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
