import { renderHook, act, waitFor } from '@testing-library/react';
import { useUpload, MAX_VIDEO_SIZE, MAX_PDF_SIZE } from '../useUpload';
import { uploadFile } from '@/lib/api';
import { Material } from '@/types';

// Mock next/navigation
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock API
jest.mock('@/lib/api', () => ({
  uploadFile: jest.fn(),
}));

describe('useUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockFile = (name: string, type: string, size: number): File => {
    const blob = new Blob(['test content'], { type });
    return new File([blob], name, { type });
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useUpload());

    expect(result.current.file).toBeNull();
    expect(result.current.title).toBe('');
    expect(result.current.description).toBe('');
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploadStatus).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.uploadedMaterial).toBeNull();
  });

  it('should set file and clear error', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.setFile(mockFile);
    });

    expect(result.current.file).toBe(mockFile);
  });

  it('should set title and clear NO_TITLE error', () => {
    const { result } = renderHook(() => useUpload());

    act(() => {
      result.current.setTitle('Test Title');
    });

    expect(result.current.title).toBe('Test Title');
  });

  it('should set description', () => {
    const { result } = renderHook(() => useUpload());

    act(() => {
      result.current.setDescription('Test Description');
    });

    expect(result.current.description).toBe('Test Description');
  });

  it('should validate and set valid video file', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    let isValid = false;
    act(() => {
      isValid = result.current.validateAndSetFile(mockFile);
    });

    expect(isValid).toBe(true);
    expect(result.current.file).toBe(mockFile);
    expect(result.current.error).toBeNull();
  });

  it('should reject invalid file type', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.txt', 'text/plain', 1024);

    let isValid = false;
    act(() => {
      isValid = result.current.validateAndSetFile(mockFile);
    });

    expect(isValid).toBe(false);
    expect(result.current.file).toBeNull();
    expect(result.current.error?.type).toBe('INVALID_TYPE');
  });

  it('should reject video file exceeding max size', () => {
    const { result } = renderHook(() => useUpload());

    const oversizedFile = createMockFile('large.mp4', 'video/mp4', MAX_VIDEO_SIZE + 1);

    let isValid = false;
    act(() => {
      isValid = result.current.validateAndSetFile(oversizedFile);
    });

    expect(isValid).toBe(false);
    expect(result.current.error?.type).toBe('FILE_TOO_LARGE');
  });

  it('should reject PDF file exceeding max size', () => {
    const { result } = renderHook(() => useUpload());

    const oversizedFile = createMockFile('large.pdf', 'application/pdf', MAX_PDF_SIZE + 1);

    let isValid = false;
    act(() => {
      isValid = result.current.validateAndSetFile(oversizedFile);
    });

    expect(isValid).toBe(false);
    expect(result.current.error?.type).toBe('FILE_TOO_LARGE');
  });

  it('should validate form before upload', () => {
    const { result } = renderHook(() => useUpload());

    // Try to upload without file
    const validation = result.current.validateForm();

    expect(validation.valid).toBe(false);
    expect(validation.error?.type).toBe('NO_FILE');
  });

  it('should validate form requires title', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
    });

    const validation = result.current.validateForm();

    expect(validation.valid).toBe(false);
    expect(validation.error?.type).toBe('NO_TITLE');
  });

  it('should upload file successfully', async () => {
    const mockMaterial: Material = {
      id: 1,
      title: 'Test Title',
      description: 'Test Description',
      file_path: '/path/test.mp4',
      file_size: 1024000,
      file_type: 'video',
      mime_type: 'video/mp4',
      status: 'active',
      view_count: 0,
      download_count: 0,
      like_count: 0,
      uploader_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    (uploadFile as jest.Mock).mockResolvedValue(mockMaterial);

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
      result.current.setDescription('Test Description');
    });

    let success = false;
    await act(async () => {
      success = await result.current.upload();
    });

    expect(success).toBe(true);
    expect(result.current.uploadStatus).toBe('success');
    expect(result.current.uploadedMaterial).toEqual(mockMaterial);
    expect(mockPush).toHaveBeenCalledWith('/materials/1');
  });

  it('should handle processing status', async () => {
    const mockMaterial: Material = {
      id: 1,
      title: 'Test Title',
      file_path: '/path/test.mp4',
      file_size: 1024000,
      file_type: 'video',
      mime_type: 'video/mp4',
      status: 'processing',
      view_count: 0,
      download_count: 0,
      like_count: 0,
      uploader_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    (uploadFile as jest.Mock).mockResolvedValue(mockMaterial);

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
    });

    let success = false;
    await act(async () => {
      success = await result.current.upload();
    });

    expect(success).toBe(true);
    expect(result.current.uploadStatus).toBe('processing');
  });

  it('should handle upload error', async () => {
    (uploadFile as jest.Mock).mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
    });

    let success = false;
    await act(async () => {
      success = await result.current.upload();
    });

    expect(success).toBe(false);
    expect(result.current.uploadStatus).toBe('error');
    expect(result.current.error?.type).toBe('UPLOAD_FAILED');
  });

  it('should handle 401 unauthorized error', async () => {
    const error = new Error('401 Unauthorized');
    (uploadFile as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
    });

    let success = false;
    await act(async () => {
      success = await result.current.upload();
    });

    expect(success).toBe(false);
    expect(result.current.error?.message).toContain('登录已过期');
  });

  it('should handle 413 payload too large error', async () => {
    const error = new Error('413 Payload Too Large');
    (uploadFile as jest.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
    });

    let success = false;
    await act(async () => {
      success = await result.current.upload();
    });

    expect(success).toBe(false);
    expect(result.current.error?.message).toContain('文件过大');
  });

  it('should prevent duplicate uploads', async () => {
    const mockMaterial: Material = {
      id: 1,
      title: 'Test Title',
      file_path: '/path/test.mp4',
      file_size: 1024000,
      file_type: 'video',
      mime_type: 'video/mp4',
      status: 'active',
      view_count: 0,
      download_count: 0,
      like_count: 0,
      uploader_id: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    (uploadFile as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockMaterial), 100))
    );

    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
    });

    // Start first upload
    act(() => {
      result.current.upload();
    });

    // Try second upload immediately
    let secondSuccess = true;
    await act(async () => {
      secondSuccess = await result.current.upload();
    });

    expect(secondSuccess).toBe(false);
    expect(uploadFile).toHaveBeenCalledTimes(1);
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.mp4', 'video/mp4', 1024000);

    act(() => {
      result.current.validateAndSetFile(mockFile);
      result.current.setTitle('Test Title');
      result.current.setDescription('Test Description');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.file).toBeNull();
    expect(result.current.title).toBe('');
    expect(result.current.description).toBe('');
    expect(result.current.uploadProgress).toBe(0);
    expect(result.current.uploadStatus).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.uploadedMaterial).toBeNull();
  });

  it('should accept valid PDF file', () => {
    const { result } = renderHook(() => useUpload());

    const mockFile = createMockFile('test.pdf', 'application/pdf', 1024000);

    let isValid = false;
    act(() => {
      isValid = result.current.validateAndSetFile(mockFile);
    });

    expect(isValid).toBe(true);
    expect(result.current.file).toBe(mockFile);
  });
});
