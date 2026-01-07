/**
 * Custom Logger Utility
 * 
 * Replaces console.log/error with structured logging.
 * In production, this can be extended to send logs to external services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const isDevelopment = process.env.NODE_ENV === 'development';

function formatLog(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
  if (entry.data && Object.keys(entry.data).length > 0) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`;
  }
  return `${prefix} ${entry.message}`;
}

function createLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
}

/**
 * Logger utility with structured logging support
 */
export const logger = {
  /**
   * Debug level - only shown in development
   */
  debug(message: string, data?: Record<string, unknown>): void {
    if (isDevelopment) {
      const entry = createLogEntry('debug', message, data);
      console.debug(formatLog(entry));
    }
  },

  /**
   * Info level - general information
   */
  info(message: string, data?: Record<string, unknown>): void {
    const entry = createLogEntry('info', message, data);
    console.info(formatLog(entry));
  },

  /**
   * Warning level - potential issues
   */
  warn(message: string, data?: Record<string, unknown>): void {
    const entry = createLogEntry('warn', message, data);
    console.warn(formatLog(entry));
  },

  /**
   * Error level - errors that need attention
   * Sanitizes error messages to avoid exposing sensitive info
   */
  error(message: string, error?: unknown, additionalData?: Record<string, unknown>): void {
    const entry = createLogEntry('error', message, {
      ...additionalData,
      // Only include error details in development
      ...(isDevelopment && error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : {}),
      // In production, just log error type
      ...(!isDevelopment && error instanceof Error
        ? { errorType: error.name }
        : {}),
    });
    console.error(formatLog(entry));
  },
};

/**
 * Sanitize error message for client response
 * Prevents internal details from leaking to users
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (isDevelopment && error instanceof Error) {
    return error.message;
  }
  
  // In production, return generic messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not found')) {
      return 'Resource not found';
    }
    if (message.includes('unauthorized') || message.includes('permission')) {
      return 'Unauthorized access';
    }
    if (message.includes('invalid')) {
      return 'Invalid request';
    }
    if (message.includes('timeout')) {
      return 'Request timed out';
    }
  }
  
  return 'An unexpected error occurred. Please try again.';
}
