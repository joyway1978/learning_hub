import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Header } from '@/components/Header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: '学习课件分享平台',
  description: '一个现代化的课件分享平台，支持课件上传、浏览和点赞功能',
  keywords: ['教学', '课件', '学习平台', '教育'],
  authors: [{ name: '学习课件分享平台' }],
  openGraph: {
    title: '学习课件分享平台',
    description: '课件分享平台',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background font-sans">
        <AuthProvider>
          <ProtectedRoute>
            <Header />
            <main>{children}</main>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
