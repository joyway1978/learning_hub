import { api, uploadFile, apiClient } from '../api';
import axios from 'axios';
import { getToken, refreshAccessToken, removeToken } from '../auth';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
}));

// Mock auth
jest.mock('../auth', () => ({
  getToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  removeToken: jest.fn(),
}));

describe('API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('api methods', () => {
    it('should make GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const mockGet = jest.fn().mockResolvedValue({ data: mockData });
      (apiClient as unknown as { get: jest.Mock }).get = mockGet;

      const result = await api.get('/test');

      expect(mockGet).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual(mockData);
    });

    it('should make POST request', async () => {
      const mockData = { id: 1 };
      const postData = { name: 'Test' };
      const mockPost = jest.fn().mockResolvedValue({ data: mockData });
      (apiClient as unknown as { post: jest.Mock }).post = mockPost;

      const result = await api.post('/test', postData);

      expect(mockPost).toHaveBeenCalledWith('/test', postData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PUT request', async () => {
      const mockData = { id: 1 };
      const putData = { name: 'Updated' };
      const mockPut = jest.fn().mockResolvedValue({ data: mockData });
      (apiClient as unknown as { put: jest.Mock }).put = mockPut;

      const result = await api.put('/test/1', putData);

      expect(mockPut).toHaveBeenCalledWith('/test/1', putData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make DELETE request', async () => {
      const mockDelete = jest.fn().mockResolvedValue({ data: null });
      (apiClient as unknown as { delete: jest.Mock }).delete = mockDelete;

      await api.delete('/test/1');

      expect(mockDelete).toHaveBeenCalledWith('/test/1', undefined);
    });
  });

  describe('uploadFile', () => {
    it('should upload file with progress', async () => {
      const mockData = { id: 1 };
      const mockPost = jest.fn().mockResolvedValue({ data: mockData });
      (apiClient as unknown as { post: jest.Mock }).post = mockPost;

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.mp4');

      const onProgress = jest.fn();

      const result = await uploadFile('/upload', formData, onProgress);

      expect(mockPost).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    it('should handle upload without progress callback', async () => {
      const mockData = { id: 1 };
      const mockPost = jest.fn().mockResolvedValue({ data: mockData });
      (apiClient as unknown as { post: jest.Mock }).post = mockPost;

      const formData = new FormData();

      const result = await uploadFile('/upload', formData);

      expect(mockPost).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });
  });
});

describe('API Request Interceptor', () => {
  it('interceptor is set up', () => {
    // Just verify the interceptor was registered
    expect(apiClient.interceptors.request.use).toHaveBeenCalled();
    expect(apiClient.interceptors.response.use).toHaveBeenCalled();
  });
});
