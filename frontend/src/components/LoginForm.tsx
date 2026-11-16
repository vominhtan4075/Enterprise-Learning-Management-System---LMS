"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { login } from '@/services/auth';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@novatech.com');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setIsError(false);

    try {
      const result = await login(email, password);
      setLoading(false);

      if (result.success) {
        if (result.user?.mustChangePassword) {
          router.push('/change-password');
        } else {
          router.push('/dashboard');
        }
      } else {
        setIsError(true);
        setMessage(result.message || 'Email hoặc mật khẩu không chính xác.');
      }
    } catch (err: unknown) {
      setLoading(false);
      setIsError(true);
      setMessage(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Email nội bộ NovaTech
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="name@novatech.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Mật khẩu
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          Ghi nhớ đăng nhập
        </label>
        <span className="text-xs text-slate-400">
          Hỗ trợ: IT Helpdesk
        </span>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Đang xác thực...</span>
          </>
        ) : (
          'Đăng nhập hệ thống'
        )}
      </button>

      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            isError
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 border border-slate-200">
        <p className="font-semibold text-slate-700 mb-1">Tài khoản mẫu từ Backend (guideAPI.md):</p>
        <p>• Admin: <code className="bg-white px-1 py-0.5 rounded border">admin@novatech.com</code> / <code className="bg-white px-1 py-0.5 rounded border">Password123!</code></p>
        <p>• Learner: <code className="bg-white px-1 py-0.5 rounded border">an.nguyen@novatech.com</code> / <code className="bg-white px-1 py-0.5 rounded border">Password123!</code></p>
      </div>
    </form>
  );
}
