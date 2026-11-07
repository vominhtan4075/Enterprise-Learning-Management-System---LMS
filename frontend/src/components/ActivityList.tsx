import type { ActivityItem } from '@/types';

interface ActivityListProps {
  activities: ActivityItem[];
}

export function ActivityList({ activities }: ActivityListProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Hoạt động gần đây</h3>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Xem lịch sử</button>
      </div>

      <ul className="space-y-4">
        {activities.map((activity) => (
          <li key={activity.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
            <span
              className={`mt-1 h-2.5 w-2.5 rounded-full ${
                activity.type === 'course'
                  ? 'bg-blue-500'
                  : activity.type === 'assessment'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
              }`}
            />
            <div className="flex-1">
              <p className="text-sm text-slate-700">{activity.title}</p>
              <p className="mt-1 text-xs text-slate-500">{activity.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
