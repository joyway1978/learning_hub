import { renderHook, act, waitFor } from '@testing-library/react';
import { useMaterialDetail } from '../useMaterialDetail';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Material, LikeToggleResponse } from '@/types';

// Mock API and auth
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/lib/auth', () => ({
  getToken: jest.fn(),
}));

const mockWindowLocation = {
  href: '',
  pathname: '/materials/1',
};
Object.defineProperty(window, 'location', {
  value: mockWindowLocation,
  writable: true,
});

describe('useMaterialDetail', () => {
  const mockMaterial: Material = {
    id: 1,
    title: 'Test Material',
    description: 'Test Description',
    file_path: '/path/test.mp4',
    file_size: 1024000,
    file_type: 'video',
    mime_type: 'video/mp4',
    status: 'active',
    view_count: 100,
    download_count: 50,
    like_count: 25,
    is_liked_by_me: false,
    uploader_id: 1,
    uploader: {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getToken as jest.Mock).mockReturnValue('fake-token');
    mockWindowLocation.href = '';
  });

  it('should fetch material detail on mount', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);

    const { result } = renderHook(() => useMaterialDetail(1));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.material).toEqual(mockMaterial);
    expect(result.current.isLiked).toBe(false);
    expect(result.current.likeCount).toBe(25);
    expect(api.get).toHaveBeenCalledWith('/materials/1');
  });

  it('should handle 404 error', async () => {
    const error = {
      response: { status: 404 },
    };
    (api.get as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useMaterialDetail(999));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('课件不存在或已被删除');
    expect(result.current.material).toBeNull();
  });

  it('should handle generic errors', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should toggle like when authenticated', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    const likeResponse: LikeToggleResponse = { liked: true, like_count: 26 };
    (api.post as jest.Mock).mockResolvedValue(likeResponse);

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(result.current.isLiked).toBe(true);
    expect(result.current.likeCount).toBe(26);
    expect(api.post).toHaveBeenCalledWith('/materials/1/like');
  });

  it('should redirect to login when toggling like without auth', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    (getToken as jest.Mock).mockReturnValue(null);

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.toggleLike();
    });

    expect(mockWindowLocation.href).toContain('/login');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('should prevent duplicate like requests', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    (api.post as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ liked: true, like_count: 26 }), 100))
    );

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // First call
    act(() => {
      result.current.toggleLike();
    });

    // Second call should be ignored
    act(() => {
      result.current.toggleLike();
    });

    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('should refetch material detail', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    jest.clearAllMocks();
    (api.get as jest.Mock).mockResolvedValue({ ...mockMaterial, view_count: 101 });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(result.current.material?.view_count).toBe(101);
  });

  it('should update material', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    const updatedMaterial = { ...mockMaterial, title: 'Updated Title' };
    (api.put as jest.Mock).mockResolvedValue(updatedMaterial);

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.updateMaterial({ title: 'Updated Title' });
    });

    expect(success).toBe(true);
    expect(result.current.material?.title).toBe('Updated Title');
    expect(api.put).toHaveBeenCalledWith('/materials/1', { title: 'Updated Title' });
  });

  it('should handle update error', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    (api.put as jest.Mock).mockRejectedValue({
      response: { status: 403, data: { detail: 'Permission denied' } },
    });

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.updateMaterial({ title: 'Updated Title' });
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('您只能编辑自己上传的课件');
  });

  it('should delete material', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    (api.delete as jest.Mock).mockResolvedValue({});

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.deleteMaterial();
    });

    expect(success).toBe(true);
    expect(api.delete).toHaveBeenCalledWith('/materials/1');
  });

  it('should handle delete error', async () => {
    (api.get as jest.Mock).mockResolvedValue(mockMaterial);
    (api.delete as jest.Mock).mockRejectedValue({
      response: { status: 404, data: { detail: 'Not found' } },
    });

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let success = false;
    await act(async () => {
      success = await result.current.deleteMaterial();
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('课件不存在或已被删除');
  });

  it('should handle abort error silently', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (api.get as jest.Mock).mockRejectedValue(abortError);

    const { result } = renderHook(() => useMaterialDetail(1));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('should not fetch if materialId is empty', async () => {
    renderHook(() => useMaterialDetail(''));

    expect(api.get).not.toHaveBeenCalled();
  });
});
