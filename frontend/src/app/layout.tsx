import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/context/toast-context';
import { AuthProvider } from '@/context/auth-context';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NovaTech LMS — Hệ thống Đào tạo Nội bộ & Đánh giá Năng lực',
  description:
    'Cổng quản lý đào tạo Onboarding theo vị trí, kiểm tra trắc nghiệm và ma trận năng lực nhân sự NovaTech Solutions.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
