'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { logAuth } from '@/lib/logger';

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register, isLoggedIn } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmpassword: '',
  });

  const [errors, setErrors] = useState<{
    email?: string;
    name?: string;
    password?: string;
    confirmpassword?: string;
    general?: string;
  }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 如果已登录，跳转到首页
  useEffect(() => {
    if (isLoggedIn) {
      logAuth('login', undefined, { source: 'register_redirect', redirect: searchParams.get('redirect') || '/' });
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

    // 邮箱验证
    if (!formData.email) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    // 姓名验证
    if (!formData.name) {
      newErrors.name = '请输入姓名';
    } else if (formData.name.length < 2) {
      newErrors.name = '姓名至少需要2个字符';
    } else if (formData.name.length > 50) {
      newErrors.name = '姓名不能超过50个字符';
    }

    // 密码验证
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 8) {
      newErrors.password = '密码至少需要8个字符';
    }

    // 确认密码验证
    if (!formData.confirmpassword) {
      newErrors.confirmpassword = '请确认密码';
    } else if (formData.password !== formData.confirmpassword) {
      newErrors.confirmpassword = '两次输入的密码不一致';
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

  // 处理注册
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      logAuth('register', undefined, { email: formData.email, source: 'register_form' });

      // 注册并自动登录
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
      });

      // 注册成功，等待 useEffect 检测到 isLoggedIn 变化后自动跳转
      logAuth('register_success', undefined, { email: formData.email, source: 'register_form' });
    } catch (error: any) {
      // 处理注册错误
      // FastAPI HTTPException detail is returned as response body directly
      const errorData = error.response?.data?.error;
      let errorMessage = '注册失败，请稍后重试';

      if (errorData) {
        // Check for email already exists by error code or message
        if (errorData.code === 'EMAIL_ALREADY_EXISTS' ||
            errorData.message?.includes('邮箱') ||
            errorData.message?.includes('email')) {
          errorMessage = '该邮箱已被注册';
          setErrors((prev) => ({ ...prev, email: '该邮箱已被注册' }));
        } else {
          errorMessage = errorData.message || errorMessage;
        }
      }

      // Only set general error if email-specific error is not set
      setErrors((prev) => {
        if (prev.email) {
          return prev;
        }
        return { ...prev, general: errorMessage };
      });

      logAuth('register_failed', undefined, {
        email: formData.email,
        error: errorMessage,
        errorCode: errorData?.code,
        source: 'register_form'
      });
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
    <div className="min-h-screen bg-[#fafaf9] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
      <div className="w-full max-w-[400px]">
        {/* 注册卡片 */}
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
            <h1 className="text-2xl font-semibold text-[#1c1917]">创建账号</h1>
            <p className="mt-2 text-sm text-[#78716c]">加入AI Learning，开启学习之旅</p>
          </div>

          {/* 通用错误提示 */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.general}</p>
            </div>
          )}

          {/* 注册表单 */}
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
                type="text"
                name="name"
                label="姓名"
                placeholder="请输入您的姓名"
                value={formData.name}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.name}
                required
                autoComplete="name"
                className="border-[#e7e5e4] focus:border-[#1a1a2e] focus:ring-[#1a1a2e]"
              />
            </div>

            <div>
              <Input
                type="password"
                name="password"
                label="密码"
                placeholder="请输入密码（至少8位）"
                value={formData.password}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.password}
                required
                autoComplete="new-password"
                className="border-[#e7e5e4] focus:border-[#1a1a2e] focus:ring-[#1a1a2e]"
              />
            </div>

            <div>
              <Input
                type="password"
                name="confirmpassword"
                label="确认密码"
                placeholder="请再次输入密码"
                value={formData.confirmpassword}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                error={errors.confirmpassword}
                required
                autoComplete="new-password"
                className="border-[#e7e5e4] focus:border-[#1a1a2e] focus:ring-[#1a1a2e]"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full bg-[#1a1a2e] hover:bg-[#2d2d44] text-white"
            >
              {isSubmitting ? '注册中...' : '创建账号'}
            </Button>
          </form>

          {/* 分隔线 */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e7e5e4]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-[#a8a29e]">已有账号？</span>
            </div>
          </div>

          {/* 登录链接 */}
          <div className="mt-6">
            <Link href="/login">
              <Button
                variant="outline"
                size="lg"
                className="w-full border-[#1a1a2e] text-[#1a1a2e] hover:bg-[#1a1a2e] hover:text-white"
              >
                直接登录
              </Button>
            </Link>
          </div>
        </div>

        {/* 底部版权 */}
        <p className="mt-8 text-center text-xs text-[#a8a29e]">
          注册即表示您同意我们的服务条款和隐私政策
        </p>
      </div>
    </div>
  );
}
