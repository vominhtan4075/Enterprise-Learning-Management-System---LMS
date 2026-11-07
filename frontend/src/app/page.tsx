import { LoginForm } from '@/components/LoginForm';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 lg:grid-cols-2">
        <section className="hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-6 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium tracking-[0.2em] uppercase">
              NovaTech LMS
            </div>
            <h1 className="text-4xl font-bold leading-tight">
              Hệ thống đào tạo nội bộ
            </h1>
            <p className="mt-4 max-w-md text-base text-blue-50/90">
              Theo dõi khóa học, đánh giá năng lực và nâng cao hiệu quả học tập nhân viên.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-blue-100">Tổng số khóa học</p>
              <p className="mt-2 text-3xl font-bold">24</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm text-blue-100">Nhân viên đang học</p>
              <p className="mt-2 text-3xl font-bold">1,248</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-white p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 text-center lg:text-left">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
                Chào mừng trở lại
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Đăng nhập</h2>
            </div>

            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
