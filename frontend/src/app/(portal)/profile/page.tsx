'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, KeyRound, Save } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  POSITION_LABELS,
  ROLE_LABELS,
  formatDateTime,
} from '@/lib/formatters';
import { authService } from '@/services/auth.service';
import { Button, Card, Input, PageHeader } from '@/components/ui/primitives';

export default function ProfileAndSecurityPage() {
  const { user, login, updateLocalUser } = useAuth();
  const { success, error: showError } = useToast();

  const [editedName, setEditedName] = useState<string | null>(null);
  const fullName = editedName ?? user?.fullName ?? '';
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const passwordChecks = useMemo(
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

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showError('Họ và tên không được để trống.');
      return;
    }
    setSavingName(true);
    try {
      const updated = await authService.updateMe(fullName.trim());
      updateLocalUser({ ...(user as NonNullable<typeof user>), ...updated });
      success('Đã cập nhật thông tin hồ sơ cá nhân.');
    } catch (err) {
      showError(
        'Cập nhật thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordChecks.every((c) => c.valid)) {
      showError('Mật khẩu mới chưa đáp ứng đầy đủ các tiêu chuẩn bảo mật.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('Mật khẩu xác nhận không khớp.');
      return;
    }
    setSavingPwd(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      if (user?.email) {
        await login(user.email, newPassword);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      success('Đã cập nhật mật khẩu đăng nhập thành công.');
    } catch (err) {
      showError(
        'Không thể đổi mật khẩu',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSavingPwd(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hồ sơ cá nhân & Bảo mật"
        description="Quản lý thông tin định danh tài khoản nội bộ và thiết lập mật khẩu đăng nhập an toàn."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Personal Info */}
        <div className="lg:col-span-7">
          <Card
            title="Thông tin định danh nhân sự"
            subtitle="Các thông tin vị trí, phòng ban và mã nhân viên được đồng bộ chuẩn từ hệ thống HRM."
          >
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Họ và tên hiển thị"
                  value={fullName}
                  onChange={(e) => setEditedName(e.target.value)}
                />
                <Input label="Email công ty" value={user.email} disabled />
                <Input
                  label="Vai trò hệ thống"
                  value={ROLE_LABELS[user.role]}
                  disabled
                />
                <Input
                  label="Cấp bậc vị trí"
                  value={POSITION_LABELS[user.position]}
                  disabled
                />
                <Input
                  label="Phòng ban"
                  value={user.department || 'Chưa phân phòng ban'}
                  disabled
                />
                <Input
                  label="Mã nhân viên (HRM)"
                  value={user.employeeCode || 'Nội bộ LMS'}
                  disabled
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4 text-xs text-[var(--text-muted)]">
                <span>
                  Đăng nhập gần nhất: {formatDateTime(user.lastLoginAt)}
                </span>
                <Button
                  type="submit"
                  loading={savingName}
                  leftIcon={<Save className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Lưu thay đổi hồ sơ
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right: Password & Security */}
        <div className="lg:col-span-5">
          <Card
            title="Bảo mật & Đổi mật khẩu"
            subtitle="Sau khi đổi mật khẩu, hệ thống tự động làm mới phiên làm việc an toàn."
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Mật khẩu hiện tại"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang sử dụng"
              />

              <Input
                label="Mật khẩu mới"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới"
              />

              <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 space-y-1.5">
                <p className="text-xs font-medium text-[var(--text-primary)]">
                  Yêu cầu độ mạnh mật khẩu:
                </p>
                {passwordChecks.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                  >
                    {item.valid ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                        strokeWidth={1.75}
                      />
                    ) : (
                      <Circle
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        strokeWidth={1.75}
                      />
                    )}
                    <span
                      className={
                        item.valid ? 'font-medium text-emerald-900' : ''
                      }
                    >
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

              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  loading={savingPwd}
                  leftIcon={<KeyRound className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Cập nhật mật khẩu
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
