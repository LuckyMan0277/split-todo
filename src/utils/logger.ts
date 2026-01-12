/**
 * Logging Utility Module
 *
 * Provides structured logging functions for debugging, error tracking,
 * and performance monitoring. Respects development/production environment.
 */

/**
 * Logger configuration
 */
const CONFIG = {
  // Enable debug logs only in development
  enableDebug: false, // Disable debug logs to reduce noise
  // Always enable error logs
  enableError: true,
  // Enable performance logs in development
  enablePerformance: false, // Disable performance logs to reduce noise
  // Performance threshold in milliseconds (log warning if exceeded)
  performanceThreshold: 500,
  // Enable info logs
  enableInfo: __DEV__, // Only enable info logs in development
};

/**
 * Logs a debug message with optional data.
 *
 * Only logs in development mode to avoid performance impact in production.
 * Useful for tracking application flow and state during development.
 *
 * @param message - Debug message to log
 * @param data - Optional data object to log alongside the message
 *
 * @example
 * logger.debug('Task created', { taskId: '123', title: 'My Task' });
 * // Console output (development only):
 * // [DEBUG] Task created
 * // { taskId: '123', title: 'My Task' }
 *
 * @example
 * logger.debug('Loading tasks from storage');
 * // Console output (development only):
 * // [DEBUG] Loading tasks from storage
 *
 * @example
 * // In production, this does nothing (no console output)
 * logger.debug('This will not appear in production');
 */
function debug(message: string, data?: any): void {
  if (!CONFIG.enableDebug) {
    return;
  }

  console.log(`[DEBUG] ${message}`);
  if (data !== undefined) {
    console.log(data);
  }
}

/**
 * Logs an error message with optional error object.
 *
 * Always logs errors (both development and production) for debugging
 * and error tracking. In production, errors should be sent to a
 * logging service (e.g., Sentry) - this can be added here.
 *
 * @param message - Error message to log
 * @param error - Optional Error object with stack trace
 *
 * @example
 * logger.error('Failed to save task', new Error('Storage full'));
 * // Console output:
 * // [ERROR] Failed to save task
 * // Error: Storage full
 * //   at ...stack trace...
 *
 * @example
 * logger.error('Network request failed');
 * // Console output:
 * // [ERROR] Network request failed
 *
 * @example
 * try {
 *   JSON.parse('invalid json');
 * } catch (e) {
 *   logger.error('JSON parse failed', e as Error);
 * }
 */
function error(message: string, error?: Error): void {
  if (!CONFIG.enableError) {
    return;
  }

  console.error(`[ERROR] ${message}`);
  if (error) {
    console.error(error);
  }

  // TODO: In production, send to error tracking service (e.g., Sentry)
  // if (!__DEV__) {
  //   Sentry.captureException(error, { extra: { message } });
  // }
}

/**
 * Logs a performance measurement.
 *
 * Only logs in development mode. Measures execution time of operations
 * and warns if they exceed the performance threshold (500ms).
 * Helps identify performance bottlenecks during development.
 *
 * @param label - Label describing the operation being measured
 * @param timeMs - Time taken in milliseconds
 *
 * @example
 * const startTime = Date.now();
 * await loadTasksFromStorage();
 * const endTime = Date.now();
 * logger.performance('Load tasks', endTime - startTime);
 * // Console output (if > 500ms):
 * // [PERFORMANCE] Load tasks: 650ms ⚠️ (exceeds 500ms threshold)
 * // Or (if < 500ms):
 * // [PERFORMANCE] Load tasks: 250ms
 *
 * @example
 * // Measuring a fast operation
 * const start = Date.now();
 * calcProgress(task);
 * logger.performance('Calculate progress', Date.now() - start);
 * // Console output (development only):
 * // [PERFORMANCE] Calculate progress: 2ms
 *
 * @example
 * // Measuring a slow operation
 * const start = Date.now();
 * await saveToAsyncStorage(largeData);
 * logger.performance('Save large data', Date.now() - start);
 * // Console output (development only):
 * // [PERFORMANCE] Save large data: 750ms ⚠️ (exceeds 500ms threshold)
 */
function logPerformance(label: string, timeMs: number): void {
  if (!CONFIG.enablePerformance) {
    return;
  }

  const formattedTime = timeMs.toFixed(2);
  const isSlowOperation = timeMs > CONFIG.performanceThreshold;

  if (isSlowOperation) {
    console.warn(
      `[PERFORMANCE] ${label}: ${formattedTime}ms ⚠️ (exceeds ${CONFIG.performanceThreshold}ms threshold)`
    );
  } else {
    console.log(`[PERFORMANCE] ${label}: ${formattedTime}ms`);
  }
}

/**
 * Logs an info message.
 *
 * Only logs in development mode to reduce noise.
 * Use for important events and state changes.
 *
 * @param message - Info message to log
 * @param data - Optional data object to log alongside the message
 *
 * @example
 * logger.info('Tasks loaded successfully', { count: 10 });
 * // Console output:
 * // ✓ Tasks loaded successfully
 * // { count: 10 }
 *
 * @example
 * logger.info('App initialized');
 * // Console output:
 * // ✓ App initialized
 */
function info(message: string, data?: any): void {
  if (!CONFIG.enableInfo) {
    return;
  }

  console.info(`✓ ${message}`);
  if (data !== undefined) {
    console.info(data);
  }
}

/**
 * Logs a warning message.
 *
 * Always logs warnings (both development and production).
 * Use for non-critical issues that should be addressed.
 *
 * @param message - Warning message to log
 * @param data - Optional data object to log alongside the message
 *
 * @example
 * logger.warn('Approaching storage limit', { percentUsed: 85 });
 * // Console output:
 * // [WARN] Approaching storage limit
 * // { percentUsed: 85 }
 *
 * @example
 * logger.warn('Deprecated function called');
 * // Console output:
 * // [WARN] Deprecated function called
 */
function warn(message: string, data?: any): void {
  console.warn(`[WARN] ${message}`);
  if (data !== undefined) {
    console.warn(data);
  }
}

/**
 * Creates a performance timer for measuring operation duration.
 *
 * Returns start and end functions to easily measure execution time.
 * Automatically logs the result when end() is called.
 *
 * @param label - Label describing the operation being measured
 * @returns Object with start and end functions
 *
 * @example
 * const timer = logger.startTimer('Load tasks');
 * await loadTasksFromStorage();
 * timer.end();
 * // Console output (development only):
 * // [PERFORMANCE] Load tasks: 250ms
 *
 * @example
 * async function expensiveOperation() {
 *   const timer = logger.startTimer('Expensive operation');
 *   try {
 *     // ... do work ...
 *     await processData();
 *   } finally {
 *     timer.end(); // Always logs, even if error occurs
 *   }
 * }
 */
function startTimer(label: string): { end: () => void } {
  const startTime = Date.now();

  return {
    end: () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      logPerformance(label, duration);
    },
  };
}

/**
 * Logger object with all logging methods.
 *
 * Provides a consistent interface for logging throughout the application.
 * Respects development/production environment automatically.
 */
export const logger = {
  /**
   * Log debug messages (development only)
   */
  debug,

  /**
   * Log errors (always enabled)
   */
  error,

  /**
   * Log performance metrics (development only)
   */
  performance: logPerformance,

  /**
   * Log informational messages (always enabled)
   */
  info,

  /**
   * Log warnings (always enabled)
   */
  warn,

  /**
   * Create a performance timer
   */
  startTimer,
};

/**
 * Example usage:
 *
 * import { logger } from './utils/logger';
 *
 * // Debug logging (development only)
 * logger.debug('User action', { action: 'create_task', taskId: '123' });
 *
 * // Error logging (always)
 * try {
 *   throw new Error('Something went wrong');
 * } catch (e) {
 *   logger.error('Operation failed', e as Error);
 * }
 *
 * // Performance measurement (development only)
 * const start = Date.now();
 * await expensiveOperation();
 * logger.performance('Expensive operation', Date.now() - start);
 *
 * // Or use timer
 * const timer = logger.startTimer('Load data');
 * await loadData();
 * timer.end();
 *
 * // Info logging (always)
 * logger.info('App started', { version: '1.0.0' });
 *
 * // Warning logging (always)
 * logger.warn('Storage almost full', { percentUsed: 90 });
 */
