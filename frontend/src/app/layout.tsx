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

const EXTENSION_ATTR_CLEANUP_SCRIPT = `(function(){try{var a=['bis_skin_checked','bis_register'];function c(n){if(n&&n.nodeType===1){for(var i=0;i<a.length;i++){if(n.hasAttribute(a[i]))n.removeAttribute(a[i]);}var q=n.querySelectorAll('[bis_skin_checked],[bis_register]');for(var j=0;j<q.length;j++){q[j].removeAttribute('bis_skin_checked');q[j].removeAttribute('bis_register');}}}c(document.documentElement);var o=new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var m=ms[i];if(m.type==='attributes'&&m.attributeName&&m.target.nodeType===1&&m.target.hasAttribute(m.attributeName)){m.target.removeAttribute(m.attributeName);}else if(m.type==='childList'){for(var k=0;k<m.addedNodes.length;k++)c(m.addedNodes[k]);}}});o.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:a});window.addEventListener('load',function(){setTimeout(function(){o.disconnect();},5000);});}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={inter.variable}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: EXTENSION_ATTR_CLEANUP_SCRIPT }}
        />
      </head>
      <body suppressHydrationWarning>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
