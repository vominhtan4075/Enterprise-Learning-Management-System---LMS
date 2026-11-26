'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { ApiError } from '@/lib/api-client';
import { DEMO_ACCOUNTS, type DemoAccountPreset } from '@/lib/rbac';
import { ROLE_LABELS } from '@/lib/formatters';
import { Badge, Button, Input } from '@/components/ui/primitives';
import { BrandLogo } from '@/components/ui/brand-logo';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const { success } = useToast();
  const router = useRouter();

  const [email, setEmail] = useState('fresher.java@novatech.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.mustChangePassword) {
        router.replace('/change-password');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isLoading, router]);

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

  return (
    <div
      data-theme="employee"
      className="min-h-screen bg-[#f7f8f5] text-[#15221c] flex flex-col justify-between"
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-6 pb-2">
        <BrandLogo href="/login" accentColor="#176552" />
        <span className="text-xs text-[#586760]">NovaTech Solutions</span>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-6 py-8 lg:grid-cols-12 lg:gap-14">
          {/* Left: Basic System Intro */}
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#176552]">
              Cổng Đào tạo Nội bộ
            </p>
            <h1 className="mt-2.5 text-2xl sm:text-[30px] font-semibold leading-snug tracking-tight text-[#15221c]">
              Hệ thống Đào tạo &amp; Đánh giá Năng lực Nhân sự
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#586760]">
              Không gian học tập tập trung giúp nhân sự NovaTech theo dõi lộ trình đào tạo, hoàn thành học liệu và đánh giá năng lực theo từng vị trí công việc.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-[#3d4d46]">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176552]" strokeWidth={1.75} />
                <span>Lộ trình đào tạo bài bản theo từng vị trí công việc</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176552]" strokeWidth={1.75} />
                <span>Học liệu tập trung và kiểm tra đánh giá định kỳ</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#176552]" strokeWidth={1.75} />
                <span>Theo dõi tiến độ học tập và hồ sơ năng lực cá nhân</span>
              </li>
            </ul>
          </div>

          {/* Right: Login Card */}
          <div className="lg:col-span-6">
            <div className="w-full max-w-md lg:ml-auto rounded-lg border border-[#dce5df] bg-white p-6 sm:p-7">
              <h2 className="text-lg font-semibold text-[#15221c]">Đăng nhập</h2>
              <p className="mt-1 text-xs text-[#586760]">
                Sử dụng tài khoản nội bộ của bạn để tiếp tục.
              </p>

              {errorMsg && (
                <div className="mt-4 flex items-start gap-2.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900">
                  <AlertCircle
                    className="h-4 w-4 shrink-0 text-rose-700 mt-0.5"
                    strokeWidth={1.75}
                  />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                    className="mb-1.5 block text-xs font-medium text-[#586760]"
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
                      className="h-9.5 w-full rounded-md border border-[#e2e7df] bg-white pl-3 pr-10 text-sm text-[#15221c] focus:border-[#176552] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 cursor-pointer"
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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
                  Đăng nhập
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              </form>

              <div className="mt-5 border-t border-[#e8efeb] pt-3.5">
                <button
                  type="button"
                  onClick={() => setDemoExpanded((v) => !v)}
                  className="flex w-full items-center justify-between text-left text-xs font-medium text-[#586760] hover:text-[#176552] cursor-pointer"
                >
                  <span>Tài khoản dùng thử (Demo)</span>
                  {demoExpanded ? (
                    <ChevronUp className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </button>

                {demoExpanded && (
                  <div className="mt-3 divide-y divide-[#eef3f0] rounded-md border border-[#dce5df] bg-white">
                    {DEMO_ACCOUNTS.map((preset) => {
                      const isSelected = email === preset.email;
                      const isEmployee = preset.role === 'EMPLOYEE';
                      return (
                        <div
                          key={preset.email}
                          className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${
                            isSelected ? 'bg-[#eef6f2]' : 'hover:bg-slate-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectDemo(preset, false)}
                            className="min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-[#15221c] truncate">
                                {preset.label}
                              </span>
                              <Badge
                                tone={isEmployee ? 'success' : 'info'}
                                className="text-[10px] px-1.5 py-0"
                              >
                                {preset.role}
                              </Badge>
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-[#76857e]">
                              {preset.email}
                            </p>
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleSelectDemo(preset, true)}
                            className="shrink-0 rounded border border-[#c8d5cd] bg-white px-2.5 py-1 text-[11px] font-medium text-[#176552] hover:bg-[#176552] hover:text-white transition-colors cursor-pointer"
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
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-5 text-xs text-[#76857e]">
        © NovaTech Solutions · Hệ thống Đào tạo &amp; Đánh giá Năng lực Nội bộ
      </footer>
    </div>
  );
}
