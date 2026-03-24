'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Material, LikeToggleResponse, MaterialUpdateRequest } from '@/types';
import { getToken } from '@/lib/auth';

interface UseMaterialDetailReturn {
  material: Material | null;
  isLoading: boolean;
  error: string | null;
  isLiked: boolean;
  likeCount: number;
  isLikeLoading: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  refetch: () => void;
  toggleLike: () => Promise<void>;
  updateMaterial: (data: MaterialUpdateRequest) => Promise<boolean>;
  deleteMaterial: () => Promise<boolean>;
}

export function useMaterialDetail(materialId: number | string): UseMaterialDetailReturn {
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 用于防止重复请求的ref
  const abortControllerRef = useRef<AbortController | null>(null);
  // 记录是否已经触发过浏览统计
  const viewTrackedRef = useRef(false);

  // 获取课件详情
  const fetchMaterialDetail = useCallback(async () => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<Material>(`/materials/${materialId}`);

      setMaterial(response);
      setIsLiked(response.is_liked_by_me || false);
      setLikeCount(response.like_count);

      // 浏览统计会在后端自动触发，这里只需要标记已访问
      if (!viewTrackedRef.current) {
        viewTrackedRef.current = true;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      let errorMessage = '获取课件详情失败';
      if (err instanceof Error) {
        errorMessage = err.message;
      }

      // 处理404错误
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          errorMessage = '课件不存在或已被删除';
        }
      }

      setError(errorMessage);
      setMaterial(null);
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  // 切换点赞状态
  const toggleLike = useCallback(async () => {
    // 检查是否已登录
    const token = getToken();
    if (!token) {
      // 未登录，跳转到登录页
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
      return;
    }

    if (isLikeLoading) return;

    setIsLikeLoading(true);

    try {
      const response = await api.post<LikeToggleResponse>(
        `/materials/${materialId}/like`
      );

      setIsLiked(response.liked);
      setLikeCount(response.like_count);

      // 更新material对象中的状态
      setMaterial((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          is_liked_by_me: response.liked,
          like_count: response.like_count,
        };
      });
    } catch (err) {
      console.error('点赞操作失败:', err);

      let errorMessage = '操作失败，请重试';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { detail?: string } } };
        if (axiosError.response?.status === 401) {
          errorMessage = '请先登录';
        } else if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        }
      }

      // 可以在这里添加toast提示
      console.error(errorMessage);
    } finally {
      setIsLikeLoading(false);
    }
  }, [materialId, isLikeLoading]);

  // 重新获取数据
  const refetch = useCallback(() => {
    viewTrackedRef.current = false;
    fetchMaterialDetail();
  }, [fetchMaterialDetail]);

  // 更新课件信息
  const updateMaterial = useCallback(async (data: MaterialUpdateRequest): Promise<boolean> => {
    const token = getToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
      return false;
    }

    if (isUpdating) return false;

    setIsUpdating(true);

    try {
      const response = await api.put<Material>(
        `/materials/${materialId}`,
        data
      );

      setMaterial(response);
      setError(null);
      return true;
    } catch (err) {
      console.error('更新课件失败:', err);

      let errorMessage = '更新失败，请重试';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { detail?: string } } };
        if (axiosError.response?.status === 401) {
          errorMessage = '请先登录';
        } else if (axiosError.response?.status === 403) {
          errorMessage = '您只能编辑自己上传的课件';
        } else if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        }
      }

      setError(errorMessage);
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [materialId, isUpdating]);

  // 删除课件
  const deleteMaterial = useCallback(async (): Promise<boolean> => {
    const token = getToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
      return false;
    }

    if (isDeleting) return false;

    setIsDeleting(true);

    try {
      await api.delete(`/materials/${materialId}`);

      setError(null);
      return true;
    } catch (err) {
      console.error('删除课件失败:', err);

      let errorMessage = '删除失败，请重试';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosError = err as { response?: { status?: number; data?: { detail?: string } } };
        if (axiosError.response?.status === 401) {
          errorMessage = '请先登录';
        } else if (axiosError.response?.status === 403) {
          errorMessage = '您只能删除自己上传的课件';
        } else if (axiosError.response?.status === 404) {
          errorMessage = '课件不存在或已被删除';
        } else if (axiosError.response?.data?.detail) {
          errorMessage = axiosError.response.data.detail;
        }
      }

      setError(errorMessage);
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [materialId, isDeleting]);

  // 组件挂载时获取数据
  useEffect(() => {
    if (materialId) {
      fetchMaterialDetail();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [materialId, fetchMaterialDetail]);

  return {
    material,
    isLoading,
    error,
    isLiked,
    likeCount,
    isLikeLoading,
    isUpdating,
    isDeleting,
    refetch,
    toggleLike,
    updateMaterial,
    deleteMaterial,
  };
}
