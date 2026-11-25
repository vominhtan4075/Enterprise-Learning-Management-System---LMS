'use client';

import React, { useEffect, useState } from 'react';
import { Award, KeyRound, Save, UserCheck } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  POSITION_LABELS,
  ROLE_LABELS,
  formatDateTime,
  formatScore,
} from '@/lib/formatters';
import { authService } from '@/services/auth.service';
import { reportsService } from '@/services/reports.service';
import type { PersonalCompetencyResponse } from '@/types/api.types';
import {
  Badge,
  Button,
  Card,
  Input,
  PageHeader,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives';

export default function ProfilePage() {
  const { user, login, updateLocalUser } = useAuth();
  const { success, error: showError } = useToast();

  const [editedName, setEditedName] = useState<string | null>(null);
  const fullName = editedName ?? user?.fullName ?? '';
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const [competency, setCompetency] =
    useState<PersonalCompetencyResponse | null>(null);
  const [loadingComp, setLoadingComp] = useState(true);

  useEffect(() => {
    reportsService
      .getMyCompetency()
      .then((res) => setCompetency(res))
      .catch(() => setCompetency(null))
      .finally(() => setLoadingComp(false));
  }, []);

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
      success('Đã đổi mật khẩu thành công.');
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
        description="Quản lý thông tin định danh nhân sự, mật khẩu đăng nhập và theo dõi chuẩn năng lực cá nhân."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Personal Info + Password */}
        <div className="space-y-6 lg:col-span-6">
          <Card
            title="Thông tin nhân sự"
            subtitle="Một số trường định danh tổ chức được đồng bộ từ hệ thống HRM."
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

              <div className="flex items-center justify-between border-t border-[var(--border-default)] pt-4 text-xs text-[var(--text-muted)]">
                <span>
                  Đăng nhập gần nhất: {formatDateTime(user.lastLoginAt)}
                </span>
                <Button
                  type="submit"
                  loading={savingName}
                  leftIcon={<Save className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Lưu họ tên
                </Button>
              </div>
            </form>
          </Card>

          <Card
            title="Đổi mật khẩu đăng nhập"
            subtitle="Mật khẩu mới cần tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số và ký tự đặc biệt."
          >
            <form onSubmit={handleChangePassword} className="space-y-4">
              <Input
                label="Mật khẩu hiện tại"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label="Xác nhận mật khẩu mới"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={savingPwd}
                  leftIcon={<KeyRound className="h-4 w-4" strokeWidth={1.75} />}
                >
                  Cập nhật mật khẩu
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right: Personal Competency Matrix */}
        <div className="lg:col-span-6">
          <Card
            title="Hồ sơ năng lực cá nhân"
            subtitle={`Đối chiếu điểm đánh giá thực tế với ngưỡng chuẩn vị trí ${POSITION_LABELS[user.position]}`}
            action={
              competency && (
                <Badge tone="accent">
                  Chuẩn yêu cầu: {competency.requiredScore} điểm
                </Badge>
              )
            }
          >
            {loadingComp ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !competency || competency.competencies.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)]/50 px-5 py-10 text-center">
                <Award
                  className="mx-auto h-7 w-7 text-[var(--accent)] mb-2"
                  strokeWidth={1.75}
                />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Chưa có dữ liệu điểm kỹ năng
                </p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Điểm năng lực sẽ tự động được tổng hợp ngay sau khi bạn hoàn
                  thành các bài kiểm tra Quiz gắn nhãn kỹ năng.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-4 text-center">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Điểm TB hiện tại
                    </p>
                    <p className="mt-1 text-xl font-semibold text-[var(--text-primary)] tabular-nums">
                      {formatScore(competency.avgScore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Kỹ năng Đạt chuẩn
                    </p>
                    <p className="mt-1 text-xl font-semibold text-emerald-700 tabular-nums">
                      {competency.passedCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Cần bổ sung (GAP)
                    </p>
                    <p className="mt-1 text-xl font-semibold text-rose-700 tabular-nums">
                      {competency.gapCount}
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {competency.competencies.map((skill) => {
                    const isPassed = skill.status === 'PASSED';
                    return (
                      <div
                        key={skill.skillName}
                        className="rounded-md border border-[var(--border-default)] p-3.5 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                            <UserCheck
                              className="h-4 w-4 text-[var(--accent)]"
                              strokeWidth={1.75}
                            />
                            {skill.skillName}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                              {formatScore(skill.score)} / {skill.requiredScore}
                            </span>
                            <Badge tone={isPassed ? 'success' : 'danger'}>
                              {isPassed ? 'Đạt chuẩn' : 'Cần bù kỹ năng'}
                            </Badge>
                          </div>
                        </div>
                        <ProgressBar
                          value={skill.score}
                          tone={isPassed ? 'success' : 'danger'}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
