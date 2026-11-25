'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { authService } from '@/services/auth.service';
import { Button, Input } from '@/components/ui/primitives';

export default function ChangePasswordPage() {
  const { user, login, logout } = useAuth();
  const { success, error: showError } = useToast();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checks = useMemo(
    () => [
      { label: 'Tối thiểu 8 ký tự', valid: newPassword.length >= 8 },
      { label: 'Có ít nhất 1 chữ in hoa (A-Z)', valid: /[A-Z]/.test(newPassword) },
      { label: 'Có ít nhất 1 chữ thường (a-z)', valid: /[a-z]/.test(newPassword) },
      { label: 'Có ít nhất 1 chữ số (0-9)', valid: /\d/.test(newPassword) },
      {
        label: 'Có ít nhất 1 ký tự đặc biệt (!@#$...)',
        valid: /[^A-Za-z0-9]/.test(newPassword),
      },
    ],
    [newPassword],
  );

  const allRulesValid = checks.every((c) => c.valid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesValid) {
      showError('Mật khẩu mới chưa đáp ứng đủ các điều kiện bảo mật.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      // Backend tăng tokenVersion sau khi đổi mật khẩu -> đăng nhập lại ngay để nhận JWT mới
      if (user?.email) {
        await login(user.email, newPassword);
        success(
          'Đổi mật khẩu thành công',
          'Phiên làm việc mới đã được kích hoạt an toàn.',
        );
        router.replace('/dashboard');
      } else {
        success('Đổi mật khẩu thành công', 'Vui lòng đăng nhập lại bằng mật khẩu mới.');
        router.replace('/login');
      }
    } catch (err) {
      showError(
        'Không thể đổi mật khẩu',
        err instanceof ApiError ? err.message : 'Vui lòng kiểm tra lại mật khẩu hiện tại.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-theme="employee"
      className="flex min-h-screen items-center justify-center bg-[#f4f8f5] p-5"
    >
      <div className="w-full max-w-md rounded-lg border border-[#d4e4dc] bg-white p-6 sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#bad3c6] bg-[#e8f3ee] text-[#176552]">
              <KeyRound className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#10201b]">
                Thiết lập mật khẩu mới
              </h1>
              <p className="text-xs text-[#4a5d56]">
                {user?.mustChangePassword
                  ? 'Tài khoản mới cần đổi mật khẩu trước khi truy cập hệ thống.'
                  : 'Cập nhật mật khẩu bảo mật cho tài khoản của bạn.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Mật khẩu hiện tại / tạm thời"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Nhập mật khẩu hiện tại"
          />

          <Input
            label="Mật khẩu mới"
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nhập mật khẩu mới"
          />

          <div className="rounded-md border border-[#d4e4dc] bg-[#f7faf8] p-3 space-y-1.5">
            <p className="text-xs font-medium text-[#114d3e]">
              Tiêu chuẩn mật khẩu bảo mật:
            </p>
            {checks.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-xs text-[#4a5d56]"
              >
                {item.valid ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Circle
                    className="h-3.5 w-3.5 text-slate-400 shrink-0"
                    strokeWidth={1.75}
                  />
                )}
                <span className={item.valid ? 'text-emerald-900 font-medium' : ''}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
          />

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Lưu mật khẩu & Tiếp tục
          </Button>
        </form>
      </div>
    </div>
  );
}
