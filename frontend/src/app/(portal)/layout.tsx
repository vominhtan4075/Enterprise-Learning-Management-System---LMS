'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { canAccessRoute } from '@/lib/rbac';
import { AppShell } from '@/components/layout/app-shell';
import { Button, EmptyState } from '@/components/ui/primitives';

export default function PortalProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.mustChangePassword) {
      router.replace('/change-password');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)]">
        <p className="text-sm text-[var(--text-secondary)]">
          Đang xác thực phiên làm việc...
        </p>
      </div>
    );
  }

  const permitted = canAccessRoute(pathname, user.role);

  return (
    <AppShell>
      {permitted ? (
        children
      ) : (
        <EmptyState
          icon={<ShieldAlert className="h-5 w-5" strokeWidth={1.75} />}
          title="Bạn không có quyền truy cập khu vực này"
          description="Tài khoản hiện tại không thuộc nhóm vai trò được cấp phép cho trang quản trị này."
          action={
            <Button onClick={() => router.push('/dashboard')}>
              Quay về trang Tổng quan
            </Button>
          }
        />
      )}
    </AppShell>
  );
}
