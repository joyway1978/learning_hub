import { Suspense } from 'react';
import { Metadata } from 'next';
import { RegisterForm } from './RegisterForm';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: '注册 - 学习课件分享平台',
  description: '创建账号',
};

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
