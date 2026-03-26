import { Suspense } from 'react';
import { Metadata } from 'next';
import { MaterialsListClient } from './MaterialsListClient';
import { DeleteSuccessToast } from './DeleteSuccessToast';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: '课件列表 - 学习课件分享平台',
  description: '浏览和发现优质教学资源',
};

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-800 mb-2">课件列表</h1>
          <p className="text-stone-500">浏览和发现优质教学资源</p>
        </div>

        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
            <p className="text-stone-500">加载中...</p>
          </div>
        }>
          {/* 删除成功提示 - 在 Suspense 边界内 */}
          <DeleteSuccessToast />
          <MaterialsListClient />
        </Suspense>
      </main>
    </div>
  );
}
