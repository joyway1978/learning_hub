'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMaterialDetail } from '@/hooks/useMaterialDetail';
import { VideoPlayer } from '@/components/VideoPlayer';
import { PDFViewer } from '@/components/PDFViewer';
import { LikeButton } from '@/components/LikeButton';
import { MaterialCard } from '@/components/MaterialCard';
import { useMaterials } from '@/hooks/useMaterials';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatFileSize } from '@/lib/utils';
import { Material, MaterialUpdateRequest } from '@/types';
import {
  Eye,
  Heart,
  Download,
  FileText,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Video,
  Edit,
  X,
  Trash2,
} from 'lucide-react';

interface MaterialDetailPageProps {
  params: {
    id: string;
  };
}

// 获取文件类型图标
function getFileTypeIcon(fileType: string) {
  switch (fileType) {
    case 'video':
      return <Video className="w-5 h-5" />;
    case 'pdf':
      return <FileText className="w-5 h-5" />;
    case 'ppt':
      return <FileText className="w-5 h-5" />;
    case 'doc':
      return <FileText className="w-5 h-5" />;
    default:
      return <FileText className="w-5 h-5" />;
  }
}

// 获取文件类型标签
function getFileTypeLabel(fileType: string): string {
  switch (fileType) {
    case 'video':
      return '视频';
    case 'pdf':
      return 'PDF';
    case 'ppt':
      return 'PPT';
    case 'doc':
      return '文档';
    default:
      return '其他';
  }
}

// Get stream URL (backend proxy - no CORS issues)
function getStreamUrl(materialId: number): string {
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${baseURL}/api/v1/materials/${materialId}/stream`;
}

// 相关推荐组件
function RelatedMaterials({
  currentId,
  type,
}: {
  currentId: number;
  type: string;
}) {
  const { materials, isLoading } = useMaterials({
    initialPage: 1,
    initialPageSize: 4,
    initialType: type as any,
  });

  // 过滤掉当前课件
  const relatedMaterials = materials.filter((m) => m.id !== currentId).slice(0, 4);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-md border border-stone-200 overflow-hidden animate-pulse"
          >
            <div className="aspect-video bg-stone-200" />
            <div className="p-4 space-y-2">
              <div className="h-4 bg-stone-200 rounded w-3/4" />
              <div className="h-3 bg-stone-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (relatedMaterials.length === 0) {
    return (
      <div className="text-center py-8 text-stone-500">
        <p>暂无相关推荐</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {relatedMaterials.map((material) => (
        <MaterialCard key={material.id} material={material} />
      ))}
    </div>
  );
}

export default function MaterialDetailPage({ params }: MaterialDetailPageProps) {
  const router = useRouter();
  const { id } = params;
  const materialId = parseInt(id, 10);
  const { user } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    material,
    isLoading,
    error,
    isLiked,
    likeCount,
    isLikeLoading,
    isUpdating,
    isDeleting,
    toggleLike,
    updateMaterial,
    deleteMaterial,
  } = useMaterialDetail(materialId);

  // 检查当前用户是否是上传者
  const isUploader = user && material && user.id === material.uploader_id;

  // 加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
          <p className="text-stone-600">加载课件中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !material) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-stone-800 mb-2">
            加载失败
          </h2>
          <p className="text-stone-600 mb-6">{error || '课件不存在'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-stone-200 hover:bg-stone-300 rounded-md text-stone-700 transition-colors"
            >
              刷新重试
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md transition-colors"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const uploaderName = material.uploader?.name || '未知用户';
  const uploaderAvatar =
    material.uploader?.avatar_url || '/images/default-avatar.png';

  // 判断是否为视频
  const isVideo = material.file_type === 'video';
  const isPDF = material.file_type === 'pdf';

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 顶部导航栏 */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-stone-600 hover:text-amber-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">返回</span>
            </button>
            <h1 className="text-lg font-semibold text-stone-800 truncate max-w-[50%] sm:max-w-md">
              {material.title}
            </h1>
            <div className="flex items-center gap-2">
              {isUploader && (
                <>
                  <button
                    onClick={() => setIsEditDialogOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-stone-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span className="hidden sm:inline">编辑</span>
                  </button>
                  <button
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">删除</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 桌面端: 左右布局 | 移动端: 上下布局 */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧: 播放器区域 (桌面端70%) */}
          <div className="w-full lg:w-[70%]">
            {/* 视频播放器 */}
            {isVideo && (
              <VideoPlayer
                src={getStreamUrl(material.id)}
                poster={material.thumbnail_path}
                title={material.title}
                className="aspect-video"
              />
            )}

            {/* PDF预览 */}
            {isPDF && (
              <PDFViewer
                src={getStreamUrl(material.id)}
                title={material.title}
                className="min-h-[500px] lg:min-h-[600px]"
              />
            )}

            {/* 其他类型文件提示 */}
            {!isVideo && !isPDF && (
              <div className="aspect-video bg-stone-100 rounded-md border border-stone-200 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-stone-600 mb-2">
                    该文件类型暂不支持在线预览
                  </p>
                  <p className="text-stone-400 text-sm">
                    文件类型: {getFileTypeLabel(material.file_type)}
                  </p>
                </div>
              </div>
            )}

            {/* 移动端: 信息面板 (在播放器下方) */}
            <div className="lg:hidden mt-6 bg-white rounded-md border border-stone-200 p-4">
              <MobileInfoPanel
                material={material}
                isLiked={isLiked}
                likeCount={likeCount}
                isLikeLoading={isLikeLoading}
                onToggleLike={toggleLike}
                uploaderName={uploaderName}
                uploaderAvatar={uploaderAvatar}
              />
            </div>
          </div>

          {/* 右侧: 信息面板 (桌面端30%) */}
          <div className="hidden lg:block w-[30%]">
            <div className="bg-white rounded-md border border-stone-200 p-6 sticky top-20">
              <DesktopInfoPanel
                material={material}
                isLiked={isLiked}
                likeCount={likeCount}
                isLikeLoading={isLikeLoading}
                onToggleLike={toggleLike}
                uploaderName={uploaderName}
                uploaderAvatar={uploaderAvatar}
              />
            </div>
          </div>
        </div>

        {/* 相关推荐 */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-stone-800 mb-4 flex items-center gap-2">
            <span className="w-1 h-6 bg-amber-500 rounded-full" />
            相关推荐
          </h2>
          <RelatedMaterials
            currentId={material.id}
            type={material.file_type}
          />
        </div>
      </div>

      {/* 编辑对话框 */}
      {isEditDialogOpen && material && (
        <EditDialog
          material={material}
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          onSave={async (data) => {
            const success = await updateMaterial(data);
            if (success) {
              setIsEditDialogOpen(false);
            }
          }}
          isLoading={isUpdating}
        />
      )}

      {/* 删除确认对话框 */}
      {isDeleteDialogOpen && material && (
        <DeleteDialog
          material={material}
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={async () => {
            const success = await deleteMaterial();
            if (success) {
              setIsDeleteDialogOpen(false);
              // 删除成功后返回首页，并带上删除成功的标记
              router.push('/?deleted=true');
            }
          }}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}

// 桌面端信息面板
interface InfoPanelProps {
  material: any;
  isLiked: boolean;
  likeCount: number;
  isLikeLoading: boolean;
  onToggleLike: () => void;
  uploaderName: string;
  uploaderAvatar: string;
}

function DesktopInfoPanel({
  material,
  isLiked,
  likeCount,
  isLikeLoading,
  onToggleLike,
  uploaderName,
  uploaderAvatar,
}: InfoPanelProps) {
  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            {getFileTypeIcon(material.file_type)}
            {getFileTypeLabel(material.file_type)}
          </span>
          {material.status === 'processing' && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
              处理中
            </span>
          )}
        </div>
        <h2 className="text-xl font-bold text-stone-800 leading-tight">
          {material.title}
        </h2>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-6 py-4 border-y border-stone-100">
        <div className="flex items-center gap-2 text-stone-600">
          <Eye className="w-5 h-5 text-amber-500" />
          <span className="font-medium">{(material.view_count ?? 0).toLocaleString()}</span>
          <span className="text-sm text-stone-400">浏览</span>
        </div>
        <div className="flex items-center gap-2 text-stone-600">
          <Heart className="w-5 h-5 text-amber-500" />
          <span className="font-medium">{likeCount.toLocaleString()}</span>
          <span className="text-sm text-stone-400">点赞</span>
        </div>
        <div className="flex items-center gap-2 text-stone-600">
          <Download className="w-5 h-5 text-amber-500" />
          <span className="font-medium">
            {(material.download_count ?? 0).toLocaleString()}
          </span>
          <span className="text-sm text-stone-400">下载</span>
        </div>
      </div>

      {/* 上传者信息 */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-stone-200 border-2 border-amber-100">
          <img
            src={uploaderAvatar}
            alt={uploaderName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/default-avatar.png';
            }}
          />
        </div>
        <div>
          <p className="font-medium text-stone-800">{uploaderName}</p>
          <p className="text-sm text-stone-500">上传者</p>
        </div>
      </div>

      {/* 描述 */}
      {material.description && (
        <div>
          <h3 className="text-sm font-medium text-stone-500 mb-2">描述</h3>
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {material.description}
          </p>
        </div>
      )}

      {/* 文件信息 */}
      <div className="bg-stone-50 rounded-md p-4 space-y-2">
        <h3 className="text-sm font-medium text-stone-500 mb-2">文件信息</h3>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">文件大小</span>
          <span className="text-stone-700">
            {formatFileSize(material.file_size)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">MIME类型</span>
          <span className="text-stone-700">{material.mime_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">上传时间</span>
          <span className="text-stone-700">
            {formatDate(material.created_at, 'short')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">更新时间</span>
          <span className="text-stone-700">
            {formatDate(material.updated_at, 'short')}
          </span>
        </div>
      </div>

      {/* 点赞按钮 */}
      <LikeButton
        isLiked={isLiked}
        likeCount={likeCount}
        isLoading={isLikeLoading}
        onToggle={onToggleLike}
        size="lg"
        className="w-full"
      />
    </div>
  );
}

// 移动端信息面板
function MobileInfoPanel({
  material,
  isLiked,
  likeCount,
  isLikeLoading,
  onToggleLike,
  uploaderName,
  uploaderAvatar,
}: InfoPanelProps) {
  return (
    <div className="space-y-4">
      {/* 标题和类型 */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            {getFileTypeIcon(material.file_type)}
            {getFileTypeLabel(material.file_type)}
          </span>
        </div>
        <h2 className="text-lg font-bold text-stone-800">{material.title}</h2>
      </div>

      {/* 统计信息和点赞按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-stone-600">
            <Eye className="w-4 h-4 text-amber-500" />
            <span className="text-sm">{(material.view_count ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-stone-600">
            <Heart className="w-4 h-4 text-amber-500" />
            <span className="text-sm">{likeCount.toLocaleString()}</span>
          </div>
        </div>
        <LikeButton
          isLiked={isLiked}
          likeCount={likeCount}
          isLoading={isLikeLoading}
          onToggle={onToggleLike}
          size="sm"
        />
      </div>

      {/* 上传者信息 */}
      <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-stone-200">
          <img
            src={uploaderAvatar}
            alt={uploaderName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/default-avatar.png';
            }}
          />
        </div>
        <div className="flex-1">
          <p className="font-medium text-stone-800 text-sm">{uploaderName}</p>
          <p className="text-xs text-stone-500">
            {formatDate(material.created_at, 'relative')}
          </p>
        </div>
      </div>

      {/* 描述 */}
      {material.description && (
        <div className="pt-3 border-t border-stone-100">
          <p className="text-stone-700 text-sm leading-relaxed whitespace-pre-wrap">
            {material.description}
          </p>
        </div>
      )}
    </div>
  );
}

// 删除确认对话框
interface DeleteDialogProps {
  material: Material;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

function DeleteDialog({ material, isOpen, onClose, onConfirm, isLoading }: DeleteDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">删除课件</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-stone-700 mb-2">
                确定要删除《{material.title}》吗？
              </p>
              <p className="text-sm text-stone-500">
                此操作不可恢复，课件将从平台移除，所有点赞和浏览数据也将丢失。
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '删除'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 编辑对话框
interface EditDialogProps {
  material: Material;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MaterialUpdateRequest) => Promise<void>;
  isLoading: boolean;
}

function EditDialog({ material, isOpen, onClose, onSave, isLoading }: EditDialogProps) {
  const [title, setTitle] = useState(material.title);
  const [description, setDescription] = useState(material.description || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }

    if (title.trim().length > 255) {
      setError('标题不能超过255个字符');
      return;
    }

    await onSave({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-800">编辑课件</h2>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              标题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder="输入课件标题"
              maxLength={255}
            />
            <p className="text-xs text-stone-400 mt-1">{title.length}/255</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              placeholder="输入课件描述（可选）"
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 text-white bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
