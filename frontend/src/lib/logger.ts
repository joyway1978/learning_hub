/**
 * Logger Utility Module
 *
 * Provides a unified logging interface for the frontend application.
 * Supports both console output and server-side logging.
 * Different log levels for development and production environments.
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Logger configuration
interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableServerLogging: boolean;
  prefix?: string;
}

// Default configuration based on environment
const getDefaultConfig = (): LoggerConfig => ({
  minLevel: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableServerLogging: process.env.NODE_ENV === 'production',
  prefix: '[AI-Hub]',
});

// Current configuration
let currentConfig: LoggerConfig = getDefaultConfig();

// Log level names for display
const levelNames: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

// Color codes for console output
const levelColors: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\x1b[36m', // Cyan
  [LogLevel.INFO]: '\x1b[32m',  // Green
  [LogLevel.WARN]: '\x1b[33m',  // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
};

const resetColor = '\x1b[0m';

/**
 * Format log message with timestamp and metadata
 */
const formatMessage = (level: LogLevel, message: string, meta?: Record<string, unknown>): string => {
  const timestamp = new Date().toISOString();
  const levelName = levelNames[level];
  const prefix = currentConfig.prefix ? `${currentConfig.prefix} ` : '';

  let formatted = `${timestamp} ${prefix}[${levelName}] ${message}`;

  if (meta && Object.keys(meta).length > 0) {
    try {
      formatted += ` ${JSON.stringify(meta)}`;
    } catch {
      formatted += ' [Unable to serialize metadata]';
    }
  }

  return formatted;
};

/**
 * Send log to server (for persistent logging)
 */
const sendToServer = async (level: LogLevel, message: string, meta?: Record<string, unknown>): Promise<void> => {
  // Only send errors and warnings to server to reduce noise
  if (level < LogLevel.WARN) return;

  try {
    // Use sendBeacon for non-blocking logging
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const logData = {
        level: levelNames[level],
        message,
        meta,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      };

      const blob = new Blob([JSON.stringify(logData)], { type: 'application/json' });
      navigator.sendBeacon('/api/v1/logs/client', blob);
    }
  } catch {
    // Silently fail - don't break the app for logging
  }
};

/**
 * Core logging function
 */
const log = (level: LogLevel, message: string, meta?: Record<string, unknown>): void => {
  // Check minimum level
  if (level < currentConfig.minLevel) return;

  const formattedMessage = formatMessage(level, message, meta);

  // Console output
  if (currentConfig.enableConsole && typeof console !== 'undefined') {
    const color = levelColors[level];
    const coloredMessage = `${color}${formattedMessage}${resetColor}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(coloredMessage, meta || '');
        break;
      case LogLevel.INFO:
        console.info(coloredMessage, meta || '');
        break;
      case LogLevel.WARN:
        console.warn(coloredMessage, meta || '');
        break;
      case LogLevel.ERROR:
        console.error(coloredMessage, meta || '');
        break;
    }
  }

  // Server logging
  if (currentConfig.enableServerLogging) {
    sendToServer(level, message, meta);
  }
};

/**
 * Logger interface
 */
export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

/**
 * Create a logger instance with optional namespace
 */
export const createLogger = (namespace?: string): Logger => {
  const prefix = namespace ? `${currentConfig.prefix || ''}[${namespace}]` : currentConfig.prefix;

  const namespacedLog = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const namespacedMessage = prefix ? `${prefix} ${message}` : message;
    log(level, namespacedMessage, meta);
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      namespacedLog(LogLevel.DEBUG, message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
      namespacedLog(LogLevel.INFO, message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
      namespacedLog(LogLevel.WARN, message, meta),
    error: (message: string, meta?: Record<string, unknown>) =>
      namespacedLog(LogLevel.ERROR, message, meta),
  };
};

/**
 * Default logger instance
 */
export const logger: Logger = createLogger();

/**
 * Configure logger settings
 */
export const configureLogger = (config: Partial<LoggerConfig>): void => {
  currentConfig = { ...currentConfig, ...config };
};

/**
 * Get current logger configuration
 */
export const getLoggerConfig = (): LoggerConfig => ({ ...currentConfig });

/**
 * Log authentication events
 */
export const logAuth = (action: 'login' | 'logout' | 'register' | 'register_success' | 'register_failed' | 'refresh' | 'token_expired', userId?: string | number, meta?: Record<string, unknown>): void => {
  const authLogger = createLogger('AUTH');
  authLogger.info(`Auth event: ${action}`, {
    action,
    userId,
    ...meta,
  });
};

/**
 * Log material-related events
 */
export const logMaterial = (action: 'list' | 'detail' | 'search' | 'filter' | 'delete', materialId?: number, meta?: Record<string, unknown>): void => {
  const materialLogger = createLogger('MATERIAL');
  materialLogger.info(`Material event: ${action}`, {
    action,
    materialId,
    ...meta,
  });
};

/**
 * Log media playback events
 */
export const logMedia = (action: 'play' | 'pause' | 'seek' | 'complete' | 'error', materialId: number, mediaType: 'video' | 'pdf', meta?: Record<string, unknown>): void => {
  const mediaLogger = createLogger('MEDIA');
  mediaLogger.info(`Media event: ${action}`, {
    action,
    materialId,
    mediaType,
    ...meta,
  });
};

/**
 * Log upload events
 */
export const logUpload = (action: 'start' | 'progress' | 'complete' | 'error' | 'cancel', fileName: string, meta?: Record<string, unknown>): void => {
  const uploadLogger = createLogger('UPLOAD');
  uploadLogger.info(`Upload event: ${action}`, {
    action,
    fileName,
    ...meta,
  });
};

/**
 * Log like/unlike events
 */
export const logLike = (action: 'like' | 'unlike', materialId: number, userId?: string | number, meta?: Record<string, unknown>): void => {
  const likeLogger = createLogger('LIKE');
  likeLogger.info(`Like event: ${action}`, {
    action,
    materialId,
    userId,
    ...meta,
  });
};

/**
 * Log API errors
 */
export const logApiError = (endpoint: string, error: unknown, meta?: Record<string, unknown>): void => {
  const errorLogger = createLogger('API_ERROR');
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  errorLogger.error(`API Error on ${endpoint}`, {
    endpoint,
    error: errorMessage,
    stack: errorStack,
    ...meta,
  });
};

/**
 * Log performance metrics
 */
export const logPerformance = (operation: string, durationMs: number, meta?: Record<string, unknown>): void => {
  const perfLogger = createLogger('PERF');
  perfLogger.debug(`Performance: ${operation} took ${durationMs}ms`, {
    operation,
    durationMs,
    ...meta,
  });
};

export default logger;
