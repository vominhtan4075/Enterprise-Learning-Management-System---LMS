'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import {
  getNavItemsForRole,
  getWorkspaceTheme,
  type NavItemConfig,
} from '@/lib/rbac';
import { ROLE_LABELS, formatDateTime } from '@/lib/formatters';
import { notificationsService } from '@/services/notifications.service';
import type { NotificationItem } from '@/types/api.types';
import { Badge } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/ui/brand-logo';

function renderNavIcon(icon: NavItemConfig['icon']) {
  const cls = 'h-4 w-4 shrink-0';
  switch (icon) {
    case 'dashboard':
      return <LayoutDashboard className={cls} strokeWidth={1.75} />;
    case 'my-learning':
      return <GraduationCap className={cls} strokeWidth={1.75} />;
    case 'paths':
      return <Compass className={cls} strokeWidth={1.75} />;
    case 'courses':
      return <BookOpen className={cls} strokeWidth={1.75} />;
    case 'enrollments':
      return <ClipboardCheck className={cls} strokeWidth={1.75} />;
    case 'competency':
      return <Award className={cls} strokeWidth={1.75} />;
    case 'reports':
      return <BarChart3 className={cls} strokeWidth={1.75} />;
    case 'hrm':
      return <RefreshCw className={cls} strokeWidth={1.75} />;
    case 'users':
      return <Users className={cls} strokeWidth={1.75} />;
    case 'notifications':
      return <Bell className={cls} strokeWidth={1.75} />;
    case 'profile':
      return <UserCircle2 className={cls} strokeWidth={1.75} />;
  }
}

const EMPLOYEE_HEADER_TABS = [
  {
    label: 'Trang Chủ',
    href: '/dashboard',
    match: (path: string) =>
      path === '/dashboard' ||
      path.startsWith('/courses/') ||
      path.startsWith('/quizzes/'),
  },
  {
    label: 'Khóa học của tôi',
    href: '/my-learning',
    match: (path: string) =>
      path === '/my-learning' || path.startsWith('/learning-paths/'),
  },
  {
    label: 'Tiến độ học tập',
    href: '/progress',
    match: (path: string) => path.startsWith('/progress'),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<NotificationItem[]>([]);

  const popoverRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const theme = getWorkspaceTheme(user?.role);
  const isEmployee = user?.role === 'EMPLOYEE';
  const isClassroomRoute = /^\/courses\/[^/]+$/.test(pathname);
  const navItems = user ? getNavItemsForRole(user.role) : [];

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsService.getAll({ page: 1, limit: 6 });
      setUnreadCount(res.unreadCount ?? 0);
      setRecentNotifs(res.data ?? []);
    } catch {
      // silent in header poll
    }
  }, [user]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 45_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem('lms_sidebar_collapsed') === '1') {
          setSidebarCollapsed(true);
        }
      } catch {
        // ignore storage errors
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('lms_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    if (notifOpen || userMenuOpen) {
      document.addEventListener('mousedown', onClickOutside);
    }
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [notifOpen, userMenuOpen]);

  const handleOpenNotification = async (item: NotificationItem) => {
    if (!item.readAt) {
      try {
        await notificationsService.markRead(item.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setRecentNotifs((list) =>
          list.map((n) =>
            n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
      } catch {
        // ignore
      }
    }
    setNotifOpen(false);
    if (item.refType === 'course' && item.refId) {
      router.push(`/courses/${item.refId}`);
    } else if (item.refType === 'path' && item.refId) {
      router.push(`/learning-paths/${item.refId}`);
    } else if (item.refType === 'quiz' && item.refId) {
      router.push(`/quizzes/${item.refId}`);
    } else {
      router.push('/notifications');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsService.markAllRead();
      setUnreadCount(0);
      setRecentNotifs((list) =>
        list.map((n) => ({
          ...n,
          readAt: n.readAt ?? new Date().toISOString(),
        })),
      );
    } catch {
      // ignore
    }
  };

  const notificationBellPopover = (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => {
          setNotifOpen((o) => !o);
          setUserMenuOpen(false);
          if (!notifOpen) void loadNotifications();
        }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors cursor-pointer ${isEmployee
          ? 'text-[#4B5952] hover:bg-[#EFF3EE]'
          : 'border border-[var(--border-default)] bg-white text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
          }`}
        aria-label="Thông báo"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-2.5 w-2.5 rounded-full bg-[#D97706] ring-2 ring-white" />
        )}
      </button>

      {notifOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-[var(--border-default)] bg-white z-50 shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Thông báo ({unreadCount} chưa đọc)
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                Đọc tất cả
              </button>
            )}
          </div>
          <div className="max-h-80 divide-y divide-[var(--border-default)] overflow-y-auto">
            {recentNotifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                Chưa có thông báo nào.
              </p>
            ) : (
              recentNotifs.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenNotification(n)}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--bg-subtle)] cursor-pointer ${!n.readAt ? 'bg-[var(--bg-subtle)]/65' : ''
                    }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      {n.title}
                    </p>
                    {!n.readAt && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {n.body}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    {formatDateTime(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="border-t border-[var(--border-default)] px-4 py-2.5 text-center">
            <Link
              href="/notifications"
              onClick={() => setNotifOpen(false)}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Xem toàn bộ trung tâm thông báo →
            </Link>
          </div>
        </div>
      )}
    </div>
  );

  // ===========================================================================
  // 1. EMPLOYEE LAYOUT: NO SIDEBAR — TOP HORIZONTAL TAB HEADER (nova / learn)
  // ===========================================================================
  if (isEmployee) {
    const shortPosition =
      user.position.charAt(0) + user.position.slice(1).toLowerCase();

    return (
      <div
        data-theme="employee"
        className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col"
      >
        <header className="sticky top-0 z-30 border-b border-[#E3E7DF] bg-white">
          <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-10">
            {/* Left: nova / learn + Horizontal Navigation Tabs */}
            <div className="flex h-full items-center gap-10 lg:gap-14">
              <BrandLogo href="/dashboard" accentColor="#176552" />

              <nav className="hidden md:flex h-full items-center gap-8">
                {EMPLOYEE_HEADER_TABS.map((tab) => {
                  const active = tab.match(pathname);
                  return (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`inline-flex h-full items-center border-b-2 px-1 text-sm transition-colors ${active
                        ? 'border-[#176552] font-semibold text-[#176552]'
                        : 'border-transparent font-medium text-[#63706A] hover:text-[#15221C]'
                        }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Right: Bell + User Dropdown */}
            <div className="flex items-center gap-4">
              {notificationBellPopover}

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-[#F3F6F2] transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold leading-tight text-[#15221C]">
                      {user.fullName}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6E7C75]">
                      Học viên · {shortPosition}
                    </p>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 text-[#6E7C75]"
                    strokeWidth={1.75}
                  />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[#E2E7DF] bg-white py-1.5 z-50 shadow-sm">
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-[#15221C] hover:bg-[#F3F6F2]"
                    >
                      <UserCircle2
                        className="h-4 w-4 text-[#176552]"
                        strokeWidth={1.75}
                      />
                      Hồ sơ & Bảo mật
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-sm text-[#15221C] hover:bg-[#F3F6F2]"
                    >
                      <span className="flex items-center gap-2.5">
                        <Bell
                          className="h-4 w-4 text-[#176552]"
                          strokeWidth={1.75}
                        />
                        Thông báo của tôi
                      </span>
                      {unreadCount > 0 && (
                        <span className="rounded bg-[#E6F2EC] px-1.5 py-0.5 text-[11px] font-semibold text-[#145343] tabular-nums">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <div className="my-1 border-t border-[#E8ECE5]" />
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.75} />
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Horizontal Tab Strip */}
          <nav className="flex md:hidden items-center gap-6 overflow-x-auto border-t border-[#EDF0EA] px-5">
            {EMPLOYEE_HEADER_TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`shrink-0 border-b-2 py-2.5 text-xs ${active
                    ? 'border-[#176552] font-semibold text-[#176552]'
                    : 'border-transparent font-medium text-[#63706A]'
                    }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main
          className={
            isClassroomRoute
              ? 'w-full flex-1'
              : 'mx-auto w-full max-w-[1360px] flex-1 px-5 py-8 sm:px-8 lg:px-10'
          }
        >
          {children}
        </main>
      </div>
    );
  }

  // ===========================================================================
  // 2. STAFF LAYOUT (ADMIN, HR, TRAINER): SOFT OCEAN BLUE SIDEBAR + HEADER
  // ===========================================================================
  const isNavActive = (href: string) =>
    pathname === href ||
    (href !== '/dashboard' && pathname.startsWith(`${href}/`));

  const mainItems = navItems.filter((i) => i.section === 'main');
  const mgmtItems = navItems.filter((i) => i.section === 'management');
  const accountItems = navItems.filter((i) => i.section === 'account');

  const renderSidebarItem = (item: NavItemConfig, collapsed: boolean) => {
    const active = isNavActive(item.href);
    const hasUnreadBadge = item.icon === 'notifications' && unreadCount > 0;

    if (collapsed) {
      return (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          aria-label={item.label}
          className={`relative mx-auto flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
            active
              ? 'bg-[var(--accent)] text-white'
              : 'text-[var(--text-secondary)] hover:bg-white/70 hover:text-[var(--text-primary)]'
          }`}
        >
          {renderNavIcon(item.icon)}
          {hasUnreadBadge && (
            <span
              className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#D97706] ring-2 ${
                active ? 'ring-[var(--accent)]' : 'ring-[var(--bg-sidebar)]'
              }`}
            />
          )}
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors ${
          active
            ? 'bg-[var(--accent)] text-white'
            : 'text-[var(--text-secondary)] hover:bg-white/70 hover:text-[var(--text-primary)]'
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {renderNavIcon(item.icon)}
          <span className="truncate">{item.label}</span>
        </span>
        {hasUnreadBadge && (
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
              active
                ? 'bg-white/20 text-white'
                : 'bg-[var(--accent)] text-white'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Link>
    );
  };

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex h-full flex-col bg-[var(--bg-sidebar)] text-[var(--text-primary)]">
      <div
        className={`flex h-16 shrink-0 items-center border-b border-[var(--border-default)] ${
          collapsed ? 'justify-center px-2' : 'justify-between px-4'
        }`}
      >
        {!collapsed && (
          <BrandLogo href="/dashboard" subtitle="Trung tâm Điều hành" />
        )}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={
            collapsed
              ? 'Mở rộng thanh điều hướng'
              : 'Thu gọn thanh điều hướng'
          }
          aria-label={
            collapsed
              ? 'Mở rộng thanh điều hướng'
              : 'Thu gọn thanh điều hướng'
          }
          className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-white/80 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded p-1 lg:hidden text-[var(--text-secondary)]"
          aria-label="Đóng menu"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <nav
        className={`flex-1 overflow-y-auto ${
          collapsed ? 'space-y-2.5 px-2 py-3' : 'space-y-3.5 p-3'
        }`}
        onClick={() => setMobileOpen(false)}
      >
        <div className="space-y-0.5">
          {!collapsed && (
            <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Không gian chính
            </p>
          )}
          {mainItems.map((item) => renderSidebarItem(item, collapsed))}
        </div>

        {mgmtItems.length > 0 && (
          <div className="space-y-0.5">
            {collapsed ? (
              <div className="mx-2 my-1.5 border-t border-[var(--border-default)]" />
            ) : (
              <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Quản trị & Báo cáo
              </p>
            )}
            {mgmtItems.map((item) => renderSidebarItem(item, collapsed))}
          </div>
        )}

        <div className="space-y-0.5">
          {collapsed ? (
            <div className="mx-2 my-1.5 border-t border-[var(--border-default)]" />
          ) : (
            <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Cá nhân
            </p>
          )}
          {accountItems.map((item) => renderSidebarItem(item, collapsed))}
        </div>
      </nav>
    </div>
  );

  return (
    <div
      data-theme={theme}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex"
    >
      <aside
        className={`hidden lg:block shrink-0 border-r border-[var(--border-default)] sticky top-0 h-screen transition-[width] duration-200 ease-in-out ${
          sidebarCollapsed ? 'w-[68px]' : 'w-60'
        }`}
      >
        {renderSidebarContent(sidebarCollapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/35"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-60 h-full border-r border-[var(--border-default)]">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border-default)] bg-white/95 backdrop-blur px-4 sm:px-6 lg:px-7">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md border border-[var(--border-default)] p-2 lg:hidden text-[var(--text-secondary)]"
              aria-label="Mở menu"
            >
              <Menu className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <div className="flex items-center gap-2">
              <Badge tone="accent">
                {user ? ROLE_LABELS[user.role] : 'Đang tải'}
              </Badge>
              {user?.department && (
                <span className="hidden sm:inline text-xs text-[var(--text-muted)]">
                  {user.department}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {notificationBellPopover}

            <Link
              href="/profile"
              className="hidden sm:inline-flex h-9 items-center gap-2 rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              <UserCircle2
                className="h-4 w-4 text-[var(--accent)]"
                strokeWidth={1.75}
              />
              <span className="max-w-[140px] truncate">{user?.fullName}</span>
            </Link>

            <button
              type="button"
              onClick={logout}
              title="Đăng xuất"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-white px-3 text-xs font-medium text-[var(--text-secondary)] hover:bg-rose-50 hover:text-rose-800 hover:border-rose-200 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        <main
          className={
            isClassroomRoute
              ? 'w-full flex-1'
              : 'mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-6 lg:px-7'
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
