import type { PositionLevel, RoleCode } from '@/types/api.types';

export type WorkspaceTheme = 'employee' | 'staff';

export interface NavItemConfig {
  label: string;
  href: string;
  icon:
    | 'dashboard'
    | 'my-learning'
    | 'paths'
    | 'courses'
    | 'enrollments'
    | 'competency'
    | 'reports'
    | 'hrm'
    | 'users'
    | 'notifications'
    | 'profile';
  roles: RoleCode[];
  section: 'main' | 'management' | 'account';
}

export const NAV_ITEMS: NavItemConfig[] = [
  {
    label: 'Tổng quan',
    href: '/dashboard',
    icon: 'dashboard',
    roles: ['EMPLOYEE', 'TRAINER', 'HR', 'ADMIN'],
    section: 'main',
  },
  {
    label: 'Học tập của tôi',
    href: '/my-learning',
    icon: 'my-learning',
    roles: ['EMPLOYEE'],
    section: 'main',
  },
  {
    label: 'Khóa học & Học liệu',
    href: '/courses',
    icon: 'courses',
    roles: ['TRAINER', 'HR', 'ADMIN'],
    section: 'main',
  },
  {
    label: 'Lộ trình 5 cấp bậc',
    href: '/learning-paths',
    icon: 'paths',
    roles: ['HR', 'ADMIN', 'TRAINER'],
    section: 'main',
  },
  {
    label: 'Giao bài & Ghi danh',
    href: '/enrollments',
    icon: 'enrollments',
    roles: ['HR', 'ADMIN', 'TRAINER'],
    section: 'management',
  },
  {
    label: 'Ma trận năng lực',
    href: '/competency',
    icon: 'competency',
    roles: ['HR', 'ADMIN', 'TRAINER'],
    section: 'management',
  },
  {
    label: 'Báo cáo đào tạo',
    href: '/reports',
    icon: 'reports',
    roles: ['HR', 'ADMIN', 'TRAINER'],
    section: 'management',
  },
  {
    label: 'Đồng bộ nhân sự HRM',
    href: '/hrm',
    icon: 'hrm',
    roles: ['HR', 'ADMIN'],
    section: 'management',
  },
  {
    label: 'Quản trị người dùng',
    href: '/users',
    icon: 'users',
    roles: ['ADMIN'],
    section: 'management',
  },
  {
    label: 'Thông báo',
    href: '/notifications',
    icon: 'notifications',
    roles: ['EMPLOYEE', 'TRAINER', 'HR', 'ADMIN'],
    section: 'account',
  },
  {
    label: 'Hồ sơ cá nhân',
    href: '/profile',
    icon: 'profile',
    roles: ['EMPLOYEE', 'TRAINER', 'HR', 'ADMIN'],
    section: 'account',
  },
];

export function getWorkspaceTheme(role?: RoleCode | null): WorkspaceTheme {
  return role === 'EMPLOYEE' ? 'employee' : 'staff';
}

export function getNavItemsForRole(role: RoleCode): NavItemConfig[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function canAccessRoute(pathname: string, role: RoleCode): boolean {
  if (pathname.startsWith('/users')) {
    return role === 'ADMIN';
  }
  if (pathname.startsWith('/hrm')) {
    return role === 'HR' || role === 'ADMIN';
  }
  if (
    pathname.startsWith('/enrollments') ||
    pathname.startsWith('/competency') ||
    pathname.startsWith('/reports')
  ) {
    return role === 'HR' || role === 'ADMIN' || role === 'TRAINER';
  }
  if (pathname === '/learning-paths') {
    return role === 'HR' || role === 'ADMIN' || role === 'TRAINER';
  }
  if (/^\/courses\/[^/]+\/builder/.test(pathname)) {
    return role === 'TRAINER' || role === 'ADMIN';
  }
  if (pathname === '/my-learning' || pathname.startsWith('/progress')) {
    return role === 'EMPLOYEE';
  }
  return true;
}

export interface DemoAccountPreset {
  label: string;
  role: RoleCode;
  position: PositionLevel;
  email: string;
  password: string;
  note: string;
}

export const DEMO_ACCOUNTS: DemoAccountPreset[] = [
  {
    label: 'Quản trị hệ thống (ADMIN)',
    role: 'ADMIN',
    position: 'LEAD',
    email: 'admin@novatech.com',
    password: 'Password123!',
    note: 'Toàn quyền tối cao + Quản lý người dùng',
  },
  {
    label: 'Quản trị Đào tạo & HR',
    role: 'HR',
    position: 'SENIOR',
    email: 'hr@novatech.com',
    password: 'Password123!',
    note: 'Lộ trình 5 cấp, Giao bài, Báo cáo & Đồng bộ HRM',
  },
  {
    label: 'Giảng viên nội bộ (TRAINER)',
    role: 'TRAINER',
    position: 'SENIOR',
    email: 'trainer@novatech.com',
    password: 'Password123!',
    note: 'Studio Khóa học, PDF & Ngân hàng câu hỏi Quiz',
  },
  {
    label: 'Học viên Fresher Java',
    role: 'EMPLOYEE',
    position: 'FRESHER',
    email: 'fresher.java@novatech.com',
    password: 'Password123!',
    note: 'Không gian học tập xanh lá + Lộ trình tuần tự BR-02',
  },
  {
    label: 'Huân Nguyễn (Học viên Junior)',
    role: 'EMPLOYEE',
    position: 'JUNIOR',
    email: 'huan.nguyen@novatech.com',
    password: 'Password123!',
    note: 'Học viên cấp Junior đã có lịch sử làm bài kiểm tra',
  },
  {
    label: 'Khánh Nguyễn (Intern)',
    role: 'EMPLOYEE',
    position: 'INTERN',
    email: 'khanh.nguyen3@novatech.com',
    password: 'Password123!',
    note: 'Học viên cấp Intern khởi đầu lộ trình',
  },
];
