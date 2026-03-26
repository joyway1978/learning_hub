'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropUpload, UploadError } from '@/components/DragDropUpload';
import { Input, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUpload } from '@/hooks/useUpload';
import { useAuth } from '@/contexts/AuthContext';

export default function UploadPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const {
    file,
    title,
    description,
    uploadProgress,
    uploadStatus,
    error,
    setFile,
    setTitle,
    setDescription,
    validateAndSetFile,
    upload,
    reset,
    validateForm,
  } = useUpload();

  // 检查登录状态
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push('/login?redirect=/upload');
    }
  }, [user, isAuthLoading, router]);

  // 处理文件选择
  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    } else {
      setFile(null);
    }
  };

  // 处理上传
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    await upload();
  };

  // 获取错误信息
  const getErrorMessage = (): string => {
    if (error?.message) {
      return error.message;
    }
    return '';
  };

  // 获取上传状态文本
  const getStatusText = (): string => {
    switch (uploadStatus) {
      case 'uploading':
        return `上传中... ${uploadProgress}%`;
      case 'processing':
        return '视频转码中，请耐心等待（可能需要几分钟）...';
      case 'success':
        return '上传成功！正在跳转...';
      case 'error':
        return '上传失败';
      default:
        return '';
    }
  };

  // 获取状态颜色
  const getStatusColor = (): string => {
    switch (uploadStatus) {
      case 'uploading':
      case 'processing':
        return 'text-primary';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-500';
      default:
        return '';
    }
  };

  // 如果正在检查登录状态，显示加载中
  if (isAuthLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  // 如果未登录，不渲染内容（会重定向到登录页）
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            上传课件
          </h1>
          <p className="text-text-secondary">
            分享您的教学资源，支持视频、PDF和Office格式
          </p>
        </div>

        {/* 上传表单 */}
        <div className="bg-surface rounded-lg shadow-sm border border-border p-6 sm:p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            {/* 文件上传区域 */}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                选择文件
                <span className="text-red-500 ml-0.5">*</span>
              </label>
              <DragDropUpload
                onFileSelect={handleFileSelect}
                selectedFile={file}
                error={error?.type as UploadError}
                errorMessage={
                  error?.type === 'FILE_TOO_LARGE' || error?.type === 'INVALID_TYPE'
                    ? error.message
                    : undefined
                }
              />
              {/* 文件类型提示 */}
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted">
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>视频：MP4、WebM、MOV、AVI、MKV等（最大 500MB，自动转码）</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <span>PDF：最大 50MB</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg
                    className="w-4 h-4 text-amber-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Office：PPTX、DOCX、XLSX（最大 50MB）</span>
                </div>
              </div>
            </div>

            {/* 标题输入 */}
            <Input
              label="课件标题"
              placeholder="请输入课件标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={error?.type === 'NO_TITLE' ? error.message : undefined}
              required
              maxLength={100}
            />

            {/* 描述输入 */}
            <Textarea
              label="课件描述"
              placeholder="可选：添加课件描述，帮助其他用户了解内容（最多500字）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              helperText={`${description.length}/500`}
              maxLength={500}
              rows={4}
            />

            {/* 上传进度 */}
            {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={getStatusColor()}>{getStatusText()}</span>
                </div>
                {/* 进度条 */}
                <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 ease-out"
                    style={{
                      width: `${uploadStatus === 'processing' ? 100 : uploadProgress}%`,
                    }}
                  />
                </div>
                {uploadStatus === 'processing' && (
                  <p className="text-xs text-text-muted">
                    正在生成缩略图，请稍候...
                  </p>
                )}
              </div>
            )}

            {/* 成功提示 */}
            {uploadStatus === 'success' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-green-700 font-medium">
                    上传成功！正在跳转到课件详情页...
                  </span>
                </div>
              </div>
            )}

            {/* 错误提示 */}
            {error &&
              error.type !== 'NO_FILE' &&
              error.type !== 'NO_TITLE' &&
              error.type !== 'FILE_TOO_LARGE' &&
              error.type !== 'INVALID_TYPE' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-red-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-red-700">{getErrorMessage()}</span>
                  </div>
                </div>
              )}

            {/* 操作按钮 */}
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                disabled={
                  !file ||
                  !title.trim() ||
                  uploadStatus === 'uploading' ||
                  uploadStatus === 'processing' ||
                  uploadStatus === 'success'
                }
                className="flex-1"
              >
                {uploadStatus === 'uploading'
                  ? '上传中...'
                  : uploadStatus === 'processing'
                  ? '处理中...'
                  : '上传课件'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  reset();
                }}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
              >
                重置
              </Button>
            </div>
          </form>
        </div>

        {/* 温馨提示 */}
        <div className="mt-8 p-4 bg-primary-50 rounded-md border border-primary-100">
          <h3 className="text-sm font-medium text-primary-800 mb-2 flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            上传提示
          </h3>
          <ul className="text-xs text-primary-700 space-y-1 list-disc list-inside">
            <li>视频文件将自动生成缩略图，处理时间取决于视频长度</li>
            <li>PDF文件将显示第一页作为缩略图</li>
            <li>请确保您拥有上传内容的版权或使用权</li>
            <li>上传完成后，其他用户可以查看和点赞您的课件</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
