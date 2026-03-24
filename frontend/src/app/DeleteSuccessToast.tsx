'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, X } from 'lucide-react';

export function DeleteSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const deleted = searchParams.get('deleted');
    if (deleted === 'true') {
      setIsVisible(true);
      // 3秒后自动隐藏
      const timer = setTimeout(() => {
        setIsVisible(false);
        // 清除 URL 参数
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-600" />
        <span className="font-medium">课件删除成功</span>
        <button
          onClick={() => {
            setIsVisible(false);
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }}
          className="ml-2 p-1 hover:bg-green-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-green-600" />
        </button>
      </div>
    </div>
  );
}
