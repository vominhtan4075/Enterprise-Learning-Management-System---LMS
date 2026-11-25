'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

export default function HomeRedirectPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
    } else if (user.mustChangePassword) {
      router.replace('/change-password');
    } else {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8f5]">
      <div className="text-center space-y-2">
        <div className="inline-flex items-baseline gap-1.5 select-none">
          <span className="text-2xl font-bold tracking-tight text-[#176552]">
            nova
          </span>
          <span className="text-xl font-light text-slate-400">/</span>
          <span className="text-xl font-normal text-slate-600">learn</span>
        </div>
        <p className="text-sm text-slate-600">Đang khởi tạo không gian làm việc...</p>
      </div>
    </div>
  );
}
