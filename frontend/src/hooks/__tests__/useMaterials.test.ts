import { renderHook, act, waitFor } from '@testing-library/react';
import { useMaterials } from '../useMaterials';
import { api } from '@/lib/api';
import { Material, PaginatedResponse } from '@/types';

// Mock next/navigation
const mockReplace = jest.fn();
const mockUseSearchParams = jest.fn();
const mockUsePathname = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('useMaterials', () => {
  const mockMaterials: Material[] = [
    {
      id: 1,
      title: 'Test Material 1',
      description: 'Description 1',
      file_path: '/path/1.mp4',
      file_size: 1024000,
      file_type: 'video',
      mime_type: 'video/mp4',
      status: 'active',
      view_count: 10,
      download_count: 5,
      like_count: 3,
      uploader_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      title: 'Test Material 2',
      description: 'Description 2',
      file_path: '/path/2.pdf',
      file_size: 512000,
      file_type: 'pdf',
      mime_type: 'application/pdf',
      status: 'active',
      view_count: 20,
      download_count: 10,
      like_count: 5,
      uploader_id: 2,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  const mockResponse: PaginatedResponse<Material> = {
    items: mockMaterials,
    total: 2,
    page: 1,
    page_size: 12,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePathname.mockReturnValue('/');
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
    (api.get as jest.Mock).mockResolvedValue(mockResponse);
  });

  it('should fetch materials on mount', async () => {
    const { result } = renderHook(() => useMaterials());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.materials).toEqual(mockMaterials);
    expect(result.current.total).toBe(2);
    expect(api.get).toHaveBeenCalledWith(
      '/materials?page=1&page_size=12&sort_by=created_at&sort_order=desc'
    );
  });

  it('should handle API errors', async () => {
    const errorMessage = 'Network error';
    (api.get as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe(errorMessage);
    expect(result.current.materials).toEqual([]);
  });

  it('should update page and reset to 1 when changing filters', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Change page
    act(() => {
      result.current.setPage(2);
    });

    expect(result.current.page).toBe(2);

    // Change sort should reset page to 1
    act(() => {
      result.current.setSortBy('view_count');
    });

    expect(result.current.page).toBe(1);
    expect(result.current.sortBy).toBe('view_count');
  });

  it('should filter by type', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setType('pdf');
    });

    expect(result.current.type).toBe('pdf');
    expect(result.current.page).toBe(1);
  });

  it('should search materials', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSearch('test query');
    });

    expect(result.current.search).toBe('test query');
    expect(result.current.page).toBe(1);
  });

  it('should change sort order', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setSortOrder('asc');
    });

    expect(result.current.sortOrder).toBe('asc');
  });

  it('should refresh materials', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    jest.clearAllMocks();

    act(() => {
      result.current.refresh();
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('should update URL params when filters change', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPage(2);
      result.current.setSortBy('like_count');
      result.current.setType('video');
      result.current.setSearch('test');
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
  });

  it('should initialize from URL params', async () => {
    const searchParams = new URLSearchParams({
      page: '3',
      sort_by: 'view_count',
      sort_order: 'asc',
      type: 'pdf',
      search: 'query',
    });
    mockUseSearchParams.mockReturnValue(searchParams);

    const { result } = renderHook(() => useMaterials());

    expect(result.current.page).toBe(3);
    expect(result.current.sortBy).toBe('view_count');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.type).toBe('pdf');
    expect(result.current.search).toBe('query');
  });

  it('should handle abort errors silently', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    (api.get as jest.Mock).mockRejectedValue(abortError);

    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
  });

  it('should set page size and reset to page 1', async () => {
    const { result } = renderHook(() => useMaterials());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPage(3);
    });

    expect(result.current.page).toBe(3);

    act(() => {
      result.current.setPageSize(24);
    });

    expect(result.current.pageSize).toBe(24);
    expect(result.current.page).toBe(1);
  });
});
