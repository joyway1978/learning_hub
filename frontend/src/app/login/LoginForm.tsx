'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoggedIn } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 如果已登录，跳转到首页
  useEffect(() => {
    if (isLoggedIn) {
      const redirect = searchParams.get('redirect');
      router.push(redirect || '/');
    }
  }, [isLoggedIn, router, searchParams]);

  // 邮箱验证
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    if (!formData.password) {
      newErrors.password = '请输入密码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 处理输入变化
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // 清除对应字段的错误
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // 处理登录
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      // 使用邮箱和密码登录
      await login({
        email: formData.email,
        password: formData.password,
      });

      // 登录成功，跳转到原页面或首页
      const redirect = searchParams.get('redirect');
      router.push(redirect || '/');
    } catch (error: any) {
      // 处理登录错误
      const errorMessage = error.response?.data?.error?.message || '登录失败，请检查邮箱和密码';
      setErrors((prev) => ({ ...prev, general: errorMessage }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 支持Enter键提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[400px]">
        {/* 登录卡片 */}
        <div className="bg-white rounded-md border border-[#e7e5e4] shadow-sm p-8">
          {/* Logo和品牌 */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-[#1a1a2e] rounded-md flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-7 h-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-[#1c1917]">欢迎回来</h1>
            <p className="mt-2 text-sm text-[#78716c]">登录您的AI Learning账号</p>
          </div>

          {/* 通用错误提示 */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                type="email"
                name="email"
                label="邮箱地址"
                placeholder="请输入邮箱地址"
                value={formData.email}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.email}
                required
                autoComplete="email"
                className="border-[#e7e5e4] focus:border-[#1a1a2e] focus:ring-[#1a1a2e]"
              />
            </div>

            <div>
              <Input
                type="password"
                name="password"
                label="密码"
                placeholder="请输入密码"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.password}
                required
                autoComplete="current-password"
                className="border-[#e7e5e4] focus:border-[#1a1a2e] focus:ring-[#1a1a2e]"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[#e7e5e4] text-[#1a1a2e] focus:ring-[#1a1a2e]"
                />
                <span className="ml-2 text-[#78716c]">记住我</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-[#1a1a2e] hover:text-[#2d2d44] font-medium"
              >
                忘记密码？
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full bg-[#1a1a2e] hover:bg-[#2d2d44] text-white"
            >
              {isSubmitting ? '登录中...' : '登录'}
            </Button>
          </form>

          {/* 分隔线 */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e7e5e4]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-[#a8a29e]">还没有账号？</span>
            </div>
          </div>

          {/* 注册链接 */}
          <div className="mt-6">
            <Link href="/register">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white"
              >
                创建新账号
              </Button>
            </Link>
          </div>
        </div>

        {/* 底部版权 */}
        <p className="mt-8 text-center text-xs text-[#a8a29e]">
          登录即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
