import type { CourseItem } from '@/types';

interface CourseListProps {
  courses: CourseItem[];
}

export function CourseList({ courses }: CourseListProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Khóa học đang theo dõi</h3>
        <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Xem tất cả</button>
      </div>

      <div className="space-y-4">
        {courses.map((course) => (
          <div key={course.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-wider text-slate-500">{course.category}</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">{course.title}</h4>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  course.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700'
                    : course.status === 'active'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-700'
                }`}
              >
                {course.status === 'completed' ? 'Hoàn thành' : course.status === 'active' ? 'Đang học' : 'Sắp diễn ra'}
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>Tiến độ</span>
                <span>{course.progress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${course.progress}%` }} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
              <span>{course.instructor}</span>
              <span>{course.duration}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
