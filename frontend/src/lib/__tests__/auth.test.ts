import {
  setToken,
  getToken,
  removeToken,
  setRefreshToken,
  getRefreshToken,
  refreshAccessToken,
  isAuthenticated,
} from '../auth';
import { api } from '../api';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock API
jest.mock('../api', () => ({
  api: {
    post: jest.fn(),
  },
}));

describe('Auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should set and get token', () => {
      const token = 'test-access-token';
      setToken(token);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('access_token', token);
    });

    it('should get token from localStorage', () => {
      const token = 'test-access-token';
      localStorageMock.getItem.mockReturnValue(token);

      const result = getToken();

      expect(localStorageMock.getItem).toHaveBeenCalledWith('access_token');
      expect(result).toBe(token);
    });

    it('should return null when token does not exist', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = getToken();

      expect(result).toBeNull();
    });

    it('should remove token', () => {
      removeToken();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
    });
  });

  describe('Refresh Token Management', () => {
    it('should set and get refresh token', () => {
      const token = 'test-refresh-token';
      setRefreshToken(token);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('refresh_token', token);
    });

    it('should get refresh token from localStorage', () => {
      const token = 'test-refresh-token';
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'refresh_token') return token;
        return null;
      });

      const result = getRefreshToken();

      expect(result).toBe(token);
    });

    it('should remove both tokens with removeToken', () => {
      removeToken();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      localStorageMock.getItem.mockReturnValue('valid-token');

      expect(isAuthenticated()).toBe(true);
    });

    it('should return false when token does not exist', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const newToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'refresh_token') return 'old-refresh-token';
        return null;
      });

      (api.post as jest.Mock).mockResolvedValue({
        access_token: newToken,
        refresh_token: newRefreshToken,
      });

      const result = await refreshAccessToken();

      expect(api.post).toHaveBeenCalledWith('/auth/refresh', {
        refresh_token: 'old-refresh-token',
      });
      expect(localStorageMock.setItem).toHaveBeenCalledWith('access_token', newToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refresh_token', newRefreshToken);
      expect(result).toBe(newToken);
    });

    it('should return null when no refresh token exists', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('should remove tokens on refresh failure', async () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'refresh_token') return 'invalid-token';
        return null;
      });

      (api.post as jest.Mock).mockRejectedValue(new Error('Invalid token'));

      const result = await refreshAccessToken();

      expect(result).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('refresh_token');
    });
  });
});
