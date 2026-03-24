import {
  cn,
  formatDate,
  formatFileSize,
  truncateText,
  generateId,
  debounce,
  throttle,
  deepClone,
  sleep,
  isValidUrl,
  getFileExtension,
  getFileTypeFromMime,
} from '../utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle conditional classes', () => {
      const condition = true;
      expect(cn('base', condition && 'conditional')).toBe('base conditional');
      expect(cn('base', !condition && 'conditional')).toBe('base');
    });

    it('should handle object syntax', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active');
    });
  });

  describe('formatDate', () => {
    it('should format date in short format', () => {
      const date = new Date('2024-01-15');
      const result = formatDate(date, 'short');
      expect(result).toMatch(/2024/);
      expect(result).toMatch(/01|1/);
      expect(result).toMatch(/15/);
    });

    it('should format date in long format', () => {
      const date = new Date('2024-01-15T10:30:00');
      const result = formatDate(date, 'long');
      expect(result).toContain('2024');
    });

    it('should format date in relative format', () => {
      const now = new Date();
      const result = formatDate(now, 'relative');
      expect(result).toBe('刚刚');
    });

    it('should return relative time for minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatDate(fiveMinutesAgo, 'relative');
      expect(result).toBe('5分钟前');
    });

    it('should return relative time for hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatDate(twoHoursAgo, 'relative');
      expect(result).toBe('2小时前');
    });

    it('should return relative time for days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatDate(threeDaysAgo, 'relative');
      expect(result).toBe('3天前');
    });

    it('should format date in ISO format', () => {
      const date = new Date('2024-01-15T10:30:00.000Z');
      const result = formatDate(date, 'iso');
      expect(result).toBe(date.toISOString());
    });

    it('should handle string date input', () => {
      const result = formatDate('2024-01-15', 'short');
      expect(result).toMatch(/2024/);
    });

    it('should handle timestamp input', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const result = formatDate(timestamp, 'short');
      expect(result).toMatch(/2024/);
    });

    it('should return "Invalid date" for invalid input', () => {
      expect(formatDate('invalid', 'short')).toBe('Invalid date');
    });
  });

  describe('formatFileSize', () => {
    it('should format 0 bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('should format KB', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format MB', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should format GB', () => {
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should respect decimal places', () => {
      expect(formatFileSize(1536, 2)).toBe('1.5 KB');
      expect(formatFileSize(1536, 0)).toBe('2 KB');
    });

    it('should format large file size', () => {
      const largeSize = 500 * 1024 * 1024; // 500MB
      expect(formatFileSize(largeSize)).toBe('500 MB');
    });
  });

  describe('truncateText', () => {
    it('should return original text if shorter than maxLength', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate text longer than maxLength', () => {
      expect(truncateText('Hello World', 8)).toBe('Hello...');
    });

    it('should use custom suffix', () => {
      expect(truncateText('Hello World', 8, '---')).toBe('Hello---');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(truncateText(null as unknown as string, 10)).toBe(null as unknown as string);
      expect(truncateText(undefined as unknown as string, 10)).toBe(undefined as unknown as string);
    });
  });

  describe('generateId', () => {
    it('should generate unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should include prefix', () => {
      const id = generateId('test_');
      expect(id).toMatch(/^test_/);
    });

    it('should generate string ID', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should delay function execution', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should reset timer on multiple calls', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(50);
      debouncedFn();
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments', () => {
      const fn = jest.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should limit function execution', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow execution after limit period', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn();
      jest.advanceTimersByTime(100);
      throttledFn();

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments', () => {
      const fn = jest.fn();
      const throttledFn = throttle(fn, 100);

      throttledFn('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(5)).toBe(5);
      expect(deepClone('test')).toBe('test');
      expect(deepClone(null)).toBe(null);
    });

    it('should clone objects', () => {
      const obj = { a: 1, b: { c: 2 } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
    });

    it('should clone arrays', () => {
      const arr = [1, 2, { a: 3 }];
      const cloned = deepClone(arr);

      expect(cloned).toEqual(arr);
      expect(cloned).not.toBe(arr);
      expect(cloned[2]).not.toBe(arr[2]);
    });

    it('should clone dates', () => {
      const date = new Date('2024-01-15');
      const cloned = deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('should handle nested structures', () => {
      const nested = {
        a: [1, 2, { b: 3 }],
        c: { d: { e: 4 } },
      };
      const cloned = deepClone(nested);

      expect(cloned).toEqual(nested);
      expect(cloned.a).not.toBe(nested.a);
      expect(cloned.c.d).not.toBe(nested.c.d);
    });
  });

  describe('sleep', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should resolve after specified time', async () => {
      const promise = sleep(100);

      jest.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should use setTimeout', () => {
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      sleep(100);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
      expect(isValidUrl('ftp://files.example.com')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('example.com')).toBe(false);
    });

    it('should handle special cases', () => {
      expect(isValidUrl('javascript:alert(1)')).toBe(true);
      expect(isValidUrl('mailto:test@example.com')).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    it('should extract extension from filename', () => {
      expect(getFileExtension('file.pdf')).toBe('pdf');
      expect(getFileExtension('document.docx')).toBe('docx');
      expect(getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return lowercase extension', () => {
      expect(getFileExtension('file.PDF')).toBe('pdf');
      expect(getFileExtension('File.TxT')).toBe('txt');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('filename')).toBe('');
      expect(getFileExtension('.htaccess')).toBe('');
    });

    it('should handle paths', () => {
      expect(getFileExtension('/path/to/file.txt')).toBe('txt');
      expect(getFileExtension('C:\\path\\to\\file.exe')).toBe('exe');
    });
  });

  describe('getFileTypeFromMime', () => {
    it('should identify PDF files', () => {
      expect(getFileTypeFromMime('application/pdf')).toBe('pdf');
    });

    it('should identify video files', () => {
      expect(getFileTypeFromMime('video/mp4')).toBe('video');
      expect(getFileTypeFromMime('video/webm')).toBe('video');
    });

    it('should identify image files', () => {
      expect(getFileTypeFromMime('image/jpeg')).toBe('image');
      expect(getFileTypeFromMime('image/png')).toBe('image');
    });

    it('should identify audio files', () => {
      expect(getFileTypeFromMime('audio/mp3')).toBe('audio');
      expect(getFileTypeFromMime('audio/wav')).toBe('audio');
    });

    it('should identify PowerPoint files', () => {
      expect(getFileTypeFromMime('application/vnd.ms-powerpoint')).toBe('ppt');
      expect(getFileTypeFromMime('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('ppt');
    });

    it('should identify Word files', () => {
      expect(getFileTypeFromMime('application/msword')).toBe('doc');
      expect(getFileTypeFromMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc');
    });

    it('should return "other" for unknown types', () => {
      expect(getFileTypeFromMime('application/unknown')).toBe('other');
      expect(getFileTypeFromMime('text/plain')).toBe('other');
    });
  });
});
