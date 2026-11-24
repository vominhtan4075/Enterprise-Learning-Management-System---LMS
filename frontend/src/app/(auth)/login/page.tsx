'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { DEMO_ACCOUNTS, type DemoAccountPreset } from '@/lib/rbac';
import { ROLE_LABELS } from '@/lib/formatters';
import { authService } from '@/services/auth.service';
import type { HealthStatusResponse } from '@/types/api.types';
import { Badge, Button, Input } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/ui/brand-logo';

const CAREER_LEVELS = [
  {
    level: 'INTERN',
    title: 'Thực tập sinh',
    benchmark: '60%',
    focus: 'Văn hóa kỹ thuật, Git quy chuẩn & Nền tảng lập trình cốt lõi',
  },
  {
    level: 'FRESHER',
    title: 'Kỹ sư Fresher',
    benchmark: '70%',
    focus: '4 Học phần chuyên môn + 1 Bài thi tổng hợp dự án thực tế',
  },
  {
    level: 'JUNIOR',
    title: 'Kỹ sư Junior',
    benchmark: '75%',
    focus: 'Tối ưu CSDL, Bảo mật dịch vụ RESTful & Kiểm thử tự động',
  },
  {
    level: 'SENIOR',
    title: 'Kỹ sư Senior',
    benchmark: '85%',
    focus: 'Kiến trúc hệ thống phân tán, Hiệu năng cao & Code Review',
  },
  {
    level: 'LEAD',
    title: 'Tech Lead / Quản lý',
    benchmark: '90%',
    focus: 'Chiến lược kỹ thuật, Quản trị rủi ro & Huấn luyện đội ngũ',
  },
];

export default function LoginMiniLandingPage() {
  const { user, isLoading, login } = useAuth();
  const { success } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState('fresher.java@novatech.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [health, setHealth] = useState<HealthStatusResponse | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    authService
      .getHealth()
      .then((res) => setHealth(res))
      .catch(() => setHealth({ status: 'error' }));
  }, []);

  const executeLogin = async (targetEmail: string, targetPassword: string) => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const loggedUser = await login(targetEmail.trim(), targetPassword);
      success(
        `Xin chào ${loggedUser.fullName}`,
        `Đã đăng nhập với vai trò ${ROLE_LABELS[loggedUser.role]}.`,
      );
      if (loggedUser.mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Đăng nhập thất bại. Vui lòng kiểm tra thông tin tài khoản.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email công ty và Mật khẩu.');
      return;
    }
    await executeLogin(email, password);
  };

  const handleSelectDemo = (preset: DemoAccountPreset, autoSignIn = false) => {
    setEmail(preset.email);
    setPassword(preset.password);
    setErrorMsg(null);
    if (autoSignIn) {
      void executeLogin(preset.email, preset.password);
    }
  };

  const isHealthy = health?.status === 'ok';

  return (
    <div
      data-theme="employee"
      className="min-h-screen bg-[#f4f8f5] text-[#10201b] flex flex-col"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#d4e4dc] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <BrandLogo href="/login" accentColor="#176552" />
            <span className="hidden sm:inline-block h-4 w-px bg-[#d4e4dc]" />
            <span className="hidden sm:inline text-xs text-[#4a5d56]">
              Đào tạo Nội bộ & Đánh giá Năng lực Nhân sự
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm text-[#4a5d56]">
            <a href="#pillars" className="hover:text-[#176552] transition-colors">
              Trụ cột vận hành
            </a>
            <a
              href="#career-levels"
              className="hover:text-[#176552] transition-colors"
            >
              Khung năng lực 5 cấp
            </a>
            <span className="inline-flex items-center gap-1.5 rounded border border-[#d4e4dc] bg-[#eef6f2] px-2.5 py-1 text-xs text-[#114d3e]">
              <span
                className={`h-2 w-2 rounded-full ${
                  health === null
                    ? 'bg-slate-400'
                    : isHealthy
                      ? 'bg-emerald-600'
                      : 'bg-rose-600'
                }`}
              />
              {health === null
                ? 'Đang kiểm tra API'
                : isHealthy
                  ? 'API & CSDL sẵn sàng'
                  : 'Chưa kết nối API'}
            </span>
          </nav>

          <a
            href="#login-panel"
            className="inline-flex h-9 items-center rounded-md bg-[#176552] px-4 text-xs font-medium text-white hover:bg-[#125041]"
          >
            Đăng nhập cổng
          </a>
        </div>
      </header>

      {/* Main Hero + Sign-in Grid */}
      <main className="flex-1">
        <section className="border-b border-[#d4e4dc] bg-[#f4f8f5]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-12">
            {/* Left Editorial Overview */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded border border-[#bad3c6] bg-[#e8f3ee] px-3 py-1 text-xs font-medium text-[#114d3e]">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Nền tảng Đào tạo Doanh nghiệp Chuẩn Hóa — Dự án DT02
                </div>

                <h1 className="text-[28px] sm:text-[32px] font-semibold leading-[1.25] tracking-tight text-[#10201b]">
                  Lộ trình Onboarding tuần tự, kiểm tra thực chất và đo lường
                  năng lực theo vị trí công việc.
                </h1>

                <p className="max-w-2xl text-[15px] text-[#4a5d56] leading-relaxed">
                  Hệ thống kết nối đồng bộ từ dữ liệu nhân sự HRM tới lộ trình
                  học tập cá nhân hóa. Học viên trải nghiệm không gian học tập
                  điềm tĩnh tập trung, trong khi Quản trị viên, HR và Giảng viên
                  điều hành toàn diện tiến độ và ma trận kỹ năng.
                </p>

                {/* Key Metrics Strip */}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 pt-1">
                  <div className="rounded-lg border border-[#d4e4dc] bg-white p-4">
                    <p className="text-xs font-medium text-[#6b7f78]">
                      Cấu trúc Lộ trình chuẩn
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#10201b] tabular-nums">
                      4 Module + 1 Final
                    </p>
                    <p className="mt-0.5 text-xs text-[#4a5d56]">
                      Mở khóa tuần tự theo quy tắc BR-02
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#d4e4dc] bg-white p-4">
                    <p className="text-xs font-medium text-[#6b7f78]">
                      Ngưỡng Đạt Bài Thi
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#176552] tabular-nums">
                      &ge; 70% Điểm chuẩn
                    </p>
                    <p className="mt-0.5 text-xs text-[#4a5d56]">
                      Tự động gợi ý bài ôn tập khi sai (BR-03)
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#d4e4dc] bg-white p-4">
                    <p className="text-xs font-medium text-[#6b7f78]">
                      Phân tách Không gian
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[#1b6ca8]">
                      4 Vai trò RBAC
                    </p>
                    <p className="mt-0.5 text-xs text-[#4a5d56]">
                      Học viên · Giảng viên · HR · Admin
                    </p>
                  </div>
                </div>
              </div>

              {/* Dual Workspace Preview Card */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-[#bad3c6] bg-[#e8f3ee] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#114d3e]">
                      Không gian Học viên (EMPLOYEE)
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#176552]" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#10201b]">
                    Giao diện Xanh lá nhạt điềm tĩnh
                  </p>
                  <p className="mt-1 text-xs text-[#4a5d56] leading-relaxed">
                    Hiển thị bài học tiếp theo cần hoàn thành, đọc PDF/Video/Markdown
                    trực tiếp và theo dõi hồ sơ kỹ năng cá nhân.
                  </p>
                </div>

                <div className="rounded-lg border border-[#bbd2e7] bg-[#eaf3fa] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#134e7a]">
                      Điều hành (ADMIN · HR · TRAINER)
                    </span>
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1b6ca8]" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-[#0f1f2e]">
                    Dashboard Xanh nước nhẹ đồng nhất
                  </p>
                  <p className="mt-1 text-xs text-[#475b6e] leading-relaxed">
                    Biên soạn khóa học & ngân hàng câu hỏi Quiz, giao lộ trình
                    hàng loạt, xuất Excel Ma trận năng lực và đồng bộ HRM.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Login Panel */}
            <div id="login-panel" className="lg:col-span-5">
              <div className="rounded-lg border border-[#d4e4dc] bg-white p-6 sm:p-7">
                <div className="mb-5 border-b border-[#e5eeea] pb-4">
                  <h2 className="text-xl font-semibold text-[#10201b]">
                    Đăng nhập hệ thống
                  </h2>
                  <p className="mt-1 text-xs text-[#4a5d56]">
                    Sử dụng tài khoản nội bộ NovaTech để truy cập không gian của
                    bạn.
                  </p>
                </div>

                {errorMsg && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-900">
                    <AlertCircle
                      className="h-4 w-4 shrink-0 text-rose-700 mt-0.5"
                      strokeWidth={1.75}
                    />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Email công ty"
                    type="email"
                    name="email"
                    autoComplete="email"
                    placeholder="ten.nhanvien@novatech.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />

                  <div>
                    <label
                      htmlFor="password"
                      className="mb-1.5 block text-xs font-medium text-[#4a5d56]"
                    >
                      Mật khẩu
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu"
                        className="h-9.5 w-full rounded-md border border-[#d4e4dc] bg-white pl-3 pr-10 text-sm text-[#10201b] focus:border-[#176552] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                        aria-label={
                          showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    loading={submitting}
                    className="w-full"
                  >
                    Đăng nhập vào không gian làm việc
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  </Button>
                </form>

                {/* Quick Demo Account Switcher */}
                <div className="mt-6 rounded-md border border-[#d4e4dc] bg-[#f7faf8]">
                  <button
                    type="button"
                    onClick={() => setDemoExpanded((v) => !v)}
                    className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-xs font-semibold text-[#114d3e] cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Chuyển nhanh tài khoản Demo (6 tài khoản mẫu)
                    </span>
                    {demoExpanded ? (
                      <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </button>

                  {demoExpanded && (
                    <div className="divide-y divide-[#e2ece7] border-t border-[#d4e4dc] bg-white">
                      {DEMO_ACCOUNTS.map((preset) => {
                        const isSelected = email === preset.email;
                        const isEmployee = preset.role === 'EMPLOYEE';
                        return (
                          <div
                            key={preset.email}
                            className={`flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs ${
                              isSelected ? 'bg-[#eef6f2]' : 'hover:bg-slate-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSelectDemo(preset, false)}
                              className="min-w-0 flex-1 text-left cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-[#10201b] truncate">
                                  {preset.label}
                                </span>
                                <Badge
                                  tone={isEmployee ? 'success' : 'info'}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {preset.role}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate text-[11px] text-[#6b7f78]">
                                {preset.email} · {preset.note}
                              </p>
                            </button>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleSelectDemo(preset, true)}
                              className="shrink-0 rounded border border-[#bad3c6] bg-white px-2.5 py-1 text-[11px] font-medium text-[#114d3e] hover:bg-[#176552] hover:text-white transition-colors cursor-pointer"
                            >
                              Vào ngay
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: 3 Core Pillars */}
        <section id="pillars" className="border-b border-[#d4e4dc] bg-white py-12">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
            <div className="mb-7 max-w-2xl">
              <h2 className="text-xl font-semibold text-[#10201b]">
                Ba trụ cột quản trị đào tạo nội bộ
              </h2>
              <p className="mt-1 text-sm text-[#4a5d56]">
                Mọi quy tắc nghiệp vụ cốt lõi được kiểm soát chặt chẽ từ tầng API
                tới trải nghiệm giao diện người dùng.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-lg border border-[#d4e4dc] bg-[#f9fbfa] p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[#bad3c6] bg-[#e8f3ee] text-[#176552]">
                  <Lock className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-[#10201b]">
                  1. Học tuần tự nghiêm ngặt (BR-02 & LP-4)
                </h3>
                <p className="mt-1.5 text-sm text-[#4a5d56] leading-relaxed">
                  Học phần tiếp theo và bài kiểm tra cuối khóa chỉ tự động mở khóa
                  khi nhân sự hoàn thành đầy đủ các bài giảng bắt buộc và vượt qua
                  bài kiểm tra của học phần liền trước.
                </p>
              </div>

              <div className="rounded-lg border border-[#d4e4dc] bg-[#f9fbfa] p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[#bad3c6] bg-[#e8f3ee] text-[#176552]">
                  <BookOpenCheck className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-[#10201b]">
                  2. Chấm điểm chuẩn & Gợi ý ôn tập (BR-01 & BR-03)
                </h3>
                <p className="mt-1.5 text-sm text-[#4a5d56] leading-relaxed">
                  Đề thi trắc nghiệm quản lý chặt số lượt làm tối đa. Khi điểm dưới
                  70%, hệ thống tự động đối chiếu từng câu trả lời sai để chỉ định
                  chính xác bài học cần xem lại.
                </p>
              </div>

              <div className="rounded-lg border border-[#d4e4dc] bg-[#f9fbfa] p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md border border-[#bbd2e7] bg-[#eaf3fa] text-[#1b6ca8]">
                  <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <h3 className="text-base font-semibold text-[#10201b]">
                  3. Đồng bộ HRM & Ma trận năng lực động
                </h3>
                <p className="mt-1.5 text-sm text-[#4a5d56] leading-relaxed">
                  Nhân viên mới từ HRM được tự động cấp tài khoản và gán đúng lộ
                  trình vị trí. Điểm thi theo từng kỹ năng được tổng hợp trực tiếp
                  thành báo cáo Ma trận năng lực xuất Excel.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: 5 Career Levels */}
        <section id="career-levels" className="bg-[#f4f8f5] py-12">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#10201b]">
                  Khung tiêu chuẩn Lộ trình & Năng lực 5 Cấp bậc
                </h2>
                <p className="mt-1 text-sm text-[#4a5d56]">
                  Mỗi vị trí công việc tại NovaTech có một lộ trình chuẩn và ngưỡng
                  điểm năng lực mục tiêu tương ứng.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#114d3e]">
                <Layers className="h-4 w-4" strokeWidth={1.75} />
                Áp dụng toàn khối Kỹ thuật & Sản phẩm
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {CAREER_LEVELS.map((item, idx) => (
                <div
                  key={item.level}
                  className="flex flex-col justify-between rounded-lg border border-[#d4e4dc] bg-white p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#6b7f78]">
                        CẤP 0{idx + 1} · {item.level}
                      </span>
                      <Badge tone="accent" className="tabular-nums">
                        Chuẩn {item.benchmark}
                      </Badge>
                    </div>
                    <h3 className="mt-2.5 text-base font-semibold text-[#10201b]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-[#4a5d56] leading-relaxed">
                      {item.focus}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 border-t border-[#eef4f0] pt-2.5 text-[11px] text-[#176552] font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>Tự động gán khi Onboarding</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Corporate Footer */}
      <footer className="border-t border-[#d4e4dc] bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-5 py-5 text-xs text-[#6b7f78] sm:flex-row sm:px-8 lg:px-10">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-[#176552]" strokeWidth={1.75} />
            <span>
              NovaTech Solutions — Hệ thống Quản lý Đào tạo Doanh nghiệp (DT02)
            </span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span>PostgreSQL: {health?.database?.status ?? '—'}</span>
            <span>Redis: {health?.redis?.status ?? '—'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
