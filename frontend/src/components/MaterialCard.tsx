'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Material } from '@/types';
import { formatDate } from '@/lib/utils';
import { Eye, Heart, FileText, Video, File } from 'lucide-react';

interface MaterialCardProps {
  material: Material;
}

// 获取文件类型图标
function getFileTypeIcon(fileType: string) {
  switch (fileType) {
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'pdf':
      return <FileText className="w-4 h-4" />;
    case 'ppt':
      return <FileText className="w-4 h-4" />;
    case 'doc':
      return <FileText className="w-4 h-4" />;
    default:
      return <File className="w-4 h-4" />;
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

// 获取缩略图URL
function getThumbnailUrl(materialId: number, thumbnailPath?: string): string {
  if (!thumbnailPath) {
    return '/images/placeholder.svg';
  }
  // 如果已经是完整URL，直接返回
  if (thumbnailPath.startsWith('http')) {
    return thumbnailPath;
  }
  // 使用缩略图API端点
  // 使用完整URL以确保SSR和客户端渲染一致
  const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  return `${baseURL}/materials/${materialId}/thumbnail`;
}

export function MaterialCard({ material }: MaterialCardProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const thumbnailUrl = getThumbnailUrl(material.id, material.thumbnail_path);
  const uploaderName = material.uploader?.name || '未知用户';
  const uploaderAvatar = material.uploader?.avatar_url || '/images/default-avatar.svg';

  return (
    <Link
      href={`/materials/${material.id}`}
      className="group block bg-white rounded-md border border-stone-200 overflow-hidden hover:shadow-md transition-shadow duration-200"
    >
      {/* 缩略图区域 */}
      <div className="relative aspect-video bg-stone-100 overflow-hidden">
        {/* 占位图背景 */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-stone-200 animate-pulse flex items-center justify-center">
            <FileText className="w-12 h-12 text-stone-300" />
          </div>
        )}

        {/* 实际图片 */}
        {!imageError ? (
          <img
            src={thumbnailUrl}
            alt={material.title}
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-100">
            <FileText className="w-16 h-16 text-stone-300" />
          </div>
        )}

        {/* 类型标签 */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded text-white text-xs">
          {getFileTypeIcon(material.file_type)}
          <span>{getFileTypeLabel(material.file_type)}</span>
        </div>

        {/* 状态标签 */}
        {material.status === 'processing' && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-amber-500/90 backdrop-blur-sm rounded text-white text-xs">
            处理中
          </div>
        )}
        {material.status === 'hidden' && (
          <div className="absolute top-2 right-2 px-2 py-1 bg-gray-500/90 backdrop-blur-sm rounded text-white text-xs">
            已隐藏
          </div>
        )}
      </div>

      {/* 内容区域 */}
      <div className="p-4">
        {/* 标题 - 最多2行 */}
        <h3 className="font-semibold text-stone-800 text-base leading-tight line-clamp-2 mb-2 min-h-[2.5rem]">
          {material.title}
        </h3>

        {/* 统计信息 */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 text-amber-500">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium text-stone-600">
              {material.view_count.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-amber-500">
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium text-stone-600">
              {material.like_count.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 上传者信息 */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 rounded-full overflow-hidden bg-stone-200">
              <img
                src={uploaderAvatar}
                alt={uploaderName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/default-avatar.svg';
                }}
              />
            </div>
            <span className="text-sm text-stone-600 truncate max-w-[80px]">
              {uploaderName}
            </span>
          </div>
          <span className="text-xs text-stone-400">
            {formatDate(material.created_at, 'relative')}
          </span>
        </div>
      </div>
    </Link>
  );
}
