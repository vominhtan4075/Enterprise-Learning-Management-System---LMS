'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Search, Trash2, Unlock, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import {
  POSITION_LABELS,
  POSITION_LEVELS,
  ROLE_CODES,
  ROLE_LABELS,
  extractRoleCode,
} from '@/lib/formatters';
import { usersService } from '@/services/users.service';
import type {
  PaginatedResponse,
  PositionLevel,
  RoleCode,
  UserSummary,
} from '@/types/api.types';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal } from '@/components/ui/overlays';
import { DataTable, type TableColumn } from '@/components/ui/data-table';

export default function UsersAdminPage() {
  const { user: currentUser } = useAuth();
  const { success, error: showError } = useToast();

  const [list, setList] = useState<PaginatedResponse<UserSummary> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleCode | ''>('');
  const [positionFilter, setPositionFilter] = useState<PositionLevel | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'true' | 'false'>('');

  // Create / Edit User Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<RoleCode>('EMPLOYEE');
  const [position, setPosition] = useState<PositionLevel>('FRESHER');
  const [department, setDepartment] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Generated Temporary Password Reveal Modal
  const [generatedPwdInfo, setGeneratedPwdInfo] = useState<{
    email: string;
    password: string;
  } | null>(null);

  const [deletingUser, setDeletingUser] = useState<UserSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersService.getAll({
        page,
        limit: 15,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        position: positionFilter || undefined,
        isActive: statusFilter === '' ? '' : statusFilter === 'true',
      });
      setList(res);
    } catch (err) {
      showError(
        'Không thể tải danh sách người dùng',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, positionFilter, statusFilter, showError]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchUsers();
    }, 0);
    return () => window.clearTimeout(t);
  }, [fetchUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setEmail('');
    setFullName('');
    setRole('EMPLOYEE');
    setPosition('FRESHER');
    setDepartment('');
    setEmployeeCode('');
    setJobTitle('');
    setPassword('');
    setModalOpen(true);
  };

  const openEditModal = (u: UserSummary) => {
    setEditingUser(u);
    setEmail(u.email);
    setFullName(u.fullName);
    setRole(extractRoleCode(u));
    setPosition(u.position);
    setDepartment(u.department || '');
    setEmployeeCode(u.employeeCode || '');
    setJobTitle(u.jobTitle || '');
    setPassword('');
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingUser) {
        await usersService.update(editingUser.id, {
          email: email.trim(),
          fullName: fullName.trim(),
          position,
          department: department.trim() || undefined,
          employeeCode: employeeCode.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          ...(password.trim() ? { password: password.trim() } : {}),
        });
        success(`Đã cập nhật hồ sơ của ${fullName}.`);
      } else {
        const created = await usersService.create({
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          position,
          department: department.trim() || undefined,
          employeeCode: employeeCode.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          ...(password.trim() ? { password: password.trim() } : {}),
        });
        success(`Đã tạo tài khoản ${created.email}.`);
        if (created.temporaryPassword) {
          setGeneratedPwdInfo({
            email: created.email,
            password: created.temporaryPassword,
          });
        }
      }
      setModalOpen(false);
      await fetchUsers();
    } catch (err) {
      showError(
        'Lưu người dùng thất bại',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (u: UserSummary, nextRole: RoleCode) => {
    try {
      await usersService.updateRole(u.id, nextRole);
      success(
        `Đã chuyển vai trò ${u.fullName} sang ${ROLE_LABELS[nextRole]}.`,
      );
      await fetchUsers();
    } catch (err) {
      showError(
        'Không thể đổi vai trò',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleToggleStatus = async (u: UserSummary) => {
    const nextActive = u.isActive === false;
    try {
      await usersService.updateStatus(u.id, nextActive);
      success(
        nextActive
          ? `Đã mở khóa tài khoản ${u.fullName}`
          : `Đã khóa tài khoản ${u.fullName}`,
      );
      await fetchUsers();
    } catch (err) {
      showError(
        'Không thể cập nhật trạng thái tài khoản',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await usersService.remove(deletingUser.id);
      success(`Đã xóa mềm tài khoản ${deletingUser.fullName}.`);
      setDeletingUser(null);
      await fetchUsers();
    } catch (err) {
      showError(
        'Không thể xóa tài khoản',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<UserSummary>[] = [
    {
      key: 'user',
      header: 'Người dùng',
      render: (u) => (
        <div>
          <p className="font-medium text-[var(--text-primary)]">{u.fullName}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {u.email}
            {u.employeeCode ? ` · ${u.employeeCode}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'org',
      header: 'Phòng ban & Cấp bậc',
      render: (u) => (
        <div className="text-xs">
          <p className="font-medium">{u.department || '—'}</p>
          <p className="text-[var(--text-muted)]">
            {POSITION_LABELS[u.position]}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Phân quyền (Role)',
      render: (u) => {
        const code = extractRoleCode(u);
        const isSelf = u.id === currentUser?.id;
        return (
          <select
            disabled={isSelf}
            value={code}
            onChange={(e) => handleChangeRole(u, e.target.value as RoleCode)}
            className="h-8 rounded border border-[var(--border-default)] bg-white px-2 text-xs font-medium disabled:bg-slate-100"
          >
            {ROLE_CODES.map((r) => (
              <option key={r} value={r}>
                {r} — {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      align: 'center',
      render: (u) =>
        u.isActive !== false ? (
          <Badge tone="success">Hoạt động</Badge>
        ) : (
          <Badge tone="danger">Đã khóa</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      render: (u) => {
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditModal(u)}
              title="Sửa hồ sơ"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            </Button>
            {!isSelf && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleToggleStatus(u)}
                  title={u.isActive === false ? 'Mở khóa' : 'Khóa tài khoản'}
                >
                  {u.isActive === false ? (
                    <Unlock
                      className="h-3.5 w-3.5 text-emerald-700"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Lock
                      className="h-3.5 w-3.5 text-amber-700"
                      strokeWidth={1.75}
                    />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeletingUser(u)}
                  title="Xóa tài khoản"
                >
                  <Trash2
                    className="h-3.5 w-3.5 text-rose-700"
                    strokeWidth={1.75}
                  />
                </Button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản trị Người dùng & Phân quyền"
        description="Cấp phát tài khoản nội bộ, điều chỉnh vai trò RBAC (EMPLOYEE, TRAINER, HR, ADMIN) và thu hồi phiên đăng nhập tức thì."
        action={
          <Button
            onClick={openCreateModal}
            leftIcon={<UserPlus className="h-4 w-4" strokeWidth={1.75} />}
          >
            Tạo người dùng mới
          </Button>
        }
      />

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--border-default)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            type="text"
            placeholder="Tìm họ tên, email, mã NV..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="h-9.5 w-full rounded-md border border-[var(--border-default)] pl-9 pr-3 text-sm focus:border-[var(--accent)] focus:outline-none"
          />
        </div>
        <Select
          value={roleFilter}
          onChange={(e) => {
            setPage(1);
            setRoleFilter(e.target.value as RoleCode | '');
          }}
          options={[
            { value: '', label: 'Tất cả vai trò' },
            ...ROLE_CODES.map((r) => ({
              value: r,
              label: `${r} — ${ROLE_LABELS[r]}`,
            })),
          ]}
        />
        <Select
          value={positionFilter}
          onChange={(e) => {
            setPage(1);
            setPositionFilter(e.target.value as PositionLevel | '');
          }}
          options={[
            { value: '', label: 'Tất cả cấp bậc' },
            ...POSITION_LEVELS.map((lvl) => ({
              value: lvl,
              label: POSITION_LABELS[lvl],
            })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as '' | 'true' | 'false');
          }}
          options={[
            { value: '', label: 'Mọi trạng thái hoạt động' },
            { value: 'true', label: 'Đang hoạt động' },
            { value: 'false', label: 'Đã khóa' },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={list?.data ?? []}
        rowKey={(r) => r.id}
        loading={loading}
        page={list?.page}
        totalPages={list?.totalPages}
        total={list?.total}
        onPageChange={setPage}
        emptyTitle="Không tìm thấy người dùng nào phù hợp"
      />

      {/* Create / Edit User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editingUser ? 'Cập nhật hồ sơ người dùng' : 'Tạo tài khoản nội bộ mới'
        }
        subtitle={
          editingUser
            ? 'Mọi thay đổi sẽ làm mới phiên token của người dùng này.'
            : 'Bỏ trống ô mật khẩu để hệ thống tự sinh mật khẩu tạm và yêu cầu đổi mật khẩu lần đầu.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveUser} loading={saving}>
              {editingUser ? 'Lưu cập nhật' : 'Tạo tài khoản'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên *"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Email công ty *"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editingUser && (
              <Select
                label="Vai trò (Role) *"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleCode)}
                options={ROLE_CODES.map((r) => ({
                  value: r,
                  label: `${r} — ${ROLE_LABELS[r]}`,
                }))}
              />
            )}
            <Select
              label="Cấp bậc vị trí *"
              value={position}
              onChange={(e) => setPosition(e.target.value as PositionLevel)}
              options={POSITION_LEVELS.map((lvl) => ({
                value: lvl,
                label: POSITION_LABELS[lvl],
              }))}
            />
            <Input
              label="Phòng ban"
              placeholder="VD: Engineering"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <Input
              label="Mã nhân viên"
              placeholder="VD: NV-1088"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
            />
          </div>

          <Input
            label={
              editingUser
                ? 'Đặt lại mật khẩu mới (để trống nếu giữ nguyên)'
                : 'Mật khẩu khởi tạo (để trống để tự sinh mật khẩu tạm)'
            }
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </form>
      </Modal>

      {/* Reveal Temporary Password Modal */}
      <Modal
        open={Boolean(generatedPwdInfo)}
        onClose={() => setGeneratedPwdInfo(null)}
        title="Mật khẩu tạm thời đã được khởi tạo"
        maxWidth="max-w-md"
        footer={
          <Button onClick={() => setGeneratedPwdInfo(null)}>Đã sao chép</Button>
        }
      >
        {generatedPwdInfo && (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--text-secondary)]">
              Vui lòng gửi mật khẩu tạm thời dưới đây cho{' '}
              <strong>{generatedPwdInfo.email}</strong>. Người dùng sẽ được yêu
              cầu đổi mật khẩu ngay trong lần đăng nhập đầu tiên:
            </p>
            <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-center font-mono text-base font-semibold text-[var(--accent)] select-all">
              {generatedPwdInfo.password}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteUser}
        loading={deleting}
        title={`Xóa mềm tài khoản ${deletingUser?.fullName}?`}
        description="Phiên đăng nhập của người dùng này sẽ bị thu hồi ngay lập tức, nhưng dữ liệu báo cáo lịch sử vẫn được giữ nguyên."
        confirmLabel="Xóa tài khoản"
      />
    </div>
  );
}
