"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser } from '@/services/auth';

interface DashboardShellProps {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Tổng quan', href: '/dashboard', icon: '▦' },
  { label: 'Khóa học', href: '/courses', icon: '◫' },
  { label: 'Ma trận năng lực', href: '/competency', icon: '◎' },
  { label: 'Người học', href: '/profile', icon: '♙' },
  { label: 'Đồng bộ HRM', href: '/hrm', icon: '↻' },
];

const pageTitles: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard': { eyebrow: 'Không gian quản trị', title: 'Admin Dashboard' },
  '/courses': { eyebrow: 'Quản lý đào tạo', title: 'Khóa học' },
  '/competency': { eyebrow: 'Báo cáo phân tích', title: 'Ma trận năng lực' },
  '/profile': { eyebrow: 'Tài khoản', title: 'Hồ sơ người dùng' },
  '/hrm': { eyebrow: 'Tích hợp nhân sự', title: 'Lịch sử đồng bộ HRM' },
};

export function DashboardShell({ children }: DashboardShellProps) {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const page = pageTitles[pathname] ?? { eyebrow: 'NovaTech LMS', title: 'Hệ thống quản trị' };

  const user = currentUser || {
    name: 'Nguyễn Minh An',
    role: 'admin',
    department: 'Phòng Nhân sự',
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-slate-800 bg-[#0b1220] px-4 py-5 lg:flex">
        <div className="flex h-12 items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3b82f6] text-lg font-black text-white shadow-lg shadow-blue-950/30">N</div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">NovaTech</p>
            <p className="text-base font-bold text-white">Learning OS</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-semibold transition ${
                  isActive
                    ? 'bg-[#1d4ed8] text-white shadow-lg shadow-blue-950/20'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-md text-sm ${isActive ? 'bg-white/10' : 'bg-slate-800/70'}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phiên bản</p>
          <p className="mt-1 text-xs font-medium text-slate-300">Enterprise LMS • 1.0</p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="flex h-[72px] items-center justify-between px-5 sm:px-7 lg:px-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">{page.eyebrow}</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{page.title}</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300" aria-label="Thông báo">
                <span className="text-lg">♢</span>
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-rose-500" />
              </button>
              <div className="hidden h-10 items-center gap-3 border-l border-slate-200 pl-3 sm:flex">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-28">
                  <p className="text-xs font-bold text-slate-800">{user.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{user.role === 'admin' ? 'Quản trị viên' : user.department}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 lg:hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold ${pathname === item.href ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto max-w-[1500px] px-5 py-6 sm:px-7 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
