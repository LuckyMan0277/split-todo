/**
 * Storage Service Module
 *
 * Provides encrypted storage-based persistence layer for the Split TODO application.
 * Handles data loading, saving, backup/recovery, schema migrations, and automatic cleanup.
 *
 * Features:
 * - Platform-native encryption (iOS: Keychain, Android: EncryptedSharedPreferences)
 * - Automatic backup on every save
 * - 1 retry on save failure
 * - Backup recovery on load failure
 * - Storage size validation (5MB limit)
 * - Automatic cleanup of old completed tasks (30 days)
 * - Schema version migration support
 * - Comprehensive error handling with AppError
 */

import { AppData, ErrorCode } from '../types';
import { isValidAppData } from '../utils/validation';
import { calculateStorageSize, checkStorageLimit } from '../utils/validation';
import { createAppError, logAppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { saveEncrypted, loadEncrypted } from './encryptedStorage';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Storage key for the main application data
 */
const STORAGE_KEY = 'APP_DATA';

/**
 * Storage key for backup data (used for recovery)
 */
const BACKUP_KEY = 'APP_DATA_BACKUP';

/**
 * Maximum storage size (5MB)
 * AsyncStorage has platform-dependent limits, we enforce 5MB for consistency
 */
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Current schema version for AppData
 * Increment this when making breaking changes to the data structure
 */
const LATEST_SCHEMA_VERSION = 1;

/**
 * Number of days after which completed tasks are auto-deleted
 */
const CLEANUP_THRESHOLD_DAYS = 30;

/**
 * Maximum number of retry attempts for save operations
 */
const MAX_SAVE_RETRIES = 1;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Loads application data from AsyncStorage.
 *
 * Implements a robust loading strategy with multiple fallback mechanisms:
 * 1. Try loading from primary storage (APP_DATA)
 * 2. Validate loaded data using type guard
 * 3. If validation fails, attempt to load from backup (APP_DATA_BACKUP)
 * 4. If backup also fails, return empty data structure
 * 5. Run schema migration if needed
 *
 * @returns Promise resolving to AppData (empty if no valid data found)
 *
 * @example
 * const data = await loadAppData();
 * console.log(`Loaded ${data.tasks.length} tasks`);
 *
 * @example
 * // Handling errors
 * try {
 *   const data = await loadAppData();
 * } catch (error) {
 *   logger.error('Failed to load data', error);
 * }
 */
export async function loadAppData(): Promise<AppData> {
  const timer = logger.startTimer('Load app data');

  try {
    logger.debug('Loading data from EncryptedStorage', { key: STORAGE_KEY });

    // Step 1: Load from primary storage (encrypted)
    const parsedData = await loadEncrypted<AppData>(STORAGE_KEY);

    // Step 2: If no data exists, return empty data
    if (!parsedData) {
      logger.info('No existing data found, returning empty data');
      timer.end();
      return createEmptyData();
    }

    // Step 3: Validate data structure
    if (!isValidAppData(parsedData)) {
      logger.warn('Data validation failed, attempting backup recovery');
      const backupData = await loadFromBackup();
      timer.end();
      return backupData;
    }

    // Step 4: Run schema migration if needed
    const migratedData = migrateSchema(parsedData);

    logger.info('Data loaded successfully', {
      taskCount: migratedData.tasks.length,
      schemaVersion: migratedData.schemaVersion,
    });

    timer.end();
    return migratedData;
  } catch (error) {
    logger.error('Error loading data, returning empty data', error as Error);

    // Log the error but don't throw - return empty data instead
    const appError = createAppError(
      ErrorCode.DATA_CORRUPTED,
      '데이터를 불러오는 데 실패했습니다',
      error as Error
    );
    logAppError(appError);

    timer.end();
    return createEmptyData();
  }
}

/**
 * Saves application data to encrypted storage with backup and retry logic.
 *
 * Implements a robust saving strategy:
 * 1. Validate storage size (5MB limit)
 * 2. If size exceeded, auto-cleanup old completed tasks
 * 3. Save to both primary storage (APP_DATA) and backup (APP_DATA_BACKUP) with encryption
 * 4. If save fails, retry once
 * 5. If retry fails, throw AppError
 *
 * @param data - AppData to save
 * @throws {AppError} If save fails after retry or if storage is full
 *
 * @example
 * const data = { schemaVersion: 1, tasks: [...] };
 * await saveAppData(data);
 *
 * @example
 * // Handling errors
 * try {
 *   await saveAppData(data);
 * } catch (error) {
 *   if (isAppError(error) && error.code === ErrorCode.STORAGE_FULL) {
 *     // Handle storage full scenario
 *     alert(error.message);
 *   }
 * }
 */
export async function saveAppData(data: AppData): Promise<void> {
  const timer = logger.startTimer('Save app data');

  try {
    logger.debug('Saving data to AsyncStorage', {
      taskCount: data.tasks.length,
      schemaVersion: data.schemaVersion,
    });

    // Step 1: Check storage size
    const sizeInBytes = calculateStorageSize(data);
    const storageLimitCheck = checkStorageLimit(sizeInBytes);

    logger.debug('Storage size check', {
      sizeInBytes,
      sizeMB: (sizeInBytes / 1024 / 1024).toFixed(2),
      valid: storageLimitCheck.valid,
    });

    // Step 2: If size exceeded, auto-cleanup and retry
    if (!storageLimitCheck.valid) {
      logger.warn('Storage size exceeded, attempting auto-cleanup', {
        sizeInBytes,
        maxSize: MAX_STORAGE_SIZE,
      });

      const cleanedData = cleanOldCompletedTasks(data);
      const cleanedSize = calculateStorageSize(cleanedData);

      // Check if cleanup helped
      if (cleanedSize >= MAX_STORAGE_SIZE) {
        const error = createAppError(
          ErrorCode.STORAGE_FULL,
          '저장 공간이 부족합니다. 자동 정리 후에도 크기가 초과되었습니다.'
        );
        logAppError(error);
        timer.end();
        throw error;
      }

      logger.info('Auto-cleanup successful', {
        originalSize: sizeInBytes,
        cleanedSize,
        tasksBefore: data.tasks.length,
        tasksAfter: cleanedData.tasks.length,
      });

      // Save cleaned data instead
      await performSave(cleanedData);
      timer.end();
      return;
    }

    // Step 3: Log warning if approaching limit
    if (storageLimitCheck.details) {
      logger.warn('Approaching storage limit', { details: storageLimitCheck.details });
    }

    // Step 4: Perform save with retry
    await performSave(data);

    logger.info('Data saved successfully', {
      taskCount: data.tasks.length,
      sizeInBytes,
    });

    timer.end();
  } catch (error) {
    logger.error('Failed to save data', error as Error);
    timer.end();
    throw error;
  }
}

/**
 * Migrates data from older schema versions to the latest version.
 *
 * Handles backward compatibility by transforming old data structures
 * to match the current schema. Currently supports:
 * - Schema v1: Current version (no migration needed)
 * - Future versions: Add migration logic as needed
 *
 * @param data - Raw data (possibly from older schema version)
 * @returns Migrated AppData with latest schema version
 *
 * @example
 * const oldData = { version: 0, tasks: [...] }; // Old format
 * const newData = migrateSchema(oldData);
 * // Returns: { schemaVersion: 1, tasks: [...] } // New format
 */
export function migrateSchema(data: any): AppData {
  const currentVersion = data.schemaVersion || 0;

  // Already at latest version
  if (currentVersion === LATEST_SCHEMA_VERSION) {
    logger.debug('Data already at latest schema version', { version: currentVersion });
    return data as AppData;
  }

  logger.info('Migrating schema', {
    from: currentVersion,
    to: LATEST_SCHEMA_VERSION,
  });

  let migratedData = { ...data };

  // Migration from v0 to v1 (initial schema)
  if (currentVersion < 1) {
    migratedData = migrateToV1(migratedData);
  }

  // Future migrations will go here
  // if (currentVersion < 2) {
  //   migratedData = migrateToV2(migratedData);
  // }

  logger.info('Schema migration completed', {
    version: migratedData.schemaVersion,
  });

  return migratedData;
}

/**
 * Removes old completed tasks to free up storage space.
 *
 * Automatically cleans up tasks that are:
 * - 100% completed (all checklist items done)
 * - Last updated more than 30 days ago
 *
 * This helps maintain storage efficiency while preserving active tasks.
 *
 * @param data - AppData to clean
 * @returns New AppData with old completed tasks removed
 *
 * @example
 * const data = { schemaVersion: 1, tasks: [...100 tasks...] };
 * const cleaned = cleanOldCompletedTasks(data);
 * console.log(`Removed ${data.tasks.length - cleaned.tasks.length} tasks`);
 *
 * @example
 * // Tasks removed in cleanup:
 * // - Task completed 35 days ago -> REMOVED
 * // - Task completed 20 days ago -> KEPT
 * // - Task 80% completed (old) -> KEPT
 */
export function cleanOldCompletedTasks(data: AppData): AppData {
  logger.debug('Cleaning old completed tasks', { totalTasks: data.tasks.length });

  const now = Date.now();
  const thresholdMs = CLEANUP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const cleanedTasks = data.tasks.filter((task) => {
    // Keep tasks with no items (empty tasks)
    if (task.items.length === 0) {
      return true;
    }

    // Check if task is 100% complete
    const completedItems = task.items.filter((item) => item.done).length;
    const isFullyCompleted = completedItems === task.items.length;

    // Keep if not fully completed
    if (!isFullyCompleted) {
      return true;
    }

    // Check if task is old (based on updatedAt)
    const updatedAt = new Date(task.updatedAt).getTime();
    const ageMs = now - updatedAt;
    const isOld = ageMs > thresholdMs;

    // Keep if not old enough
    if (!isOld) {
      return true;
    }

    // Remove this task (fully completed and old)
    logger.debug('Removing old completed task', {
      id: task.id,
      title: task.title,
      ageInDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
    });

    return false;
  });

  const removedCount = data.tasks.length - cleanedTasks.length;

  if (removedCount > 0) {
    logger.info('Cleanup completed', {
      removed: removedCount,
      remaining: cleanedTasks.length,
    });
  }

  return {
    ...data,
    tasks: cleanedTasks,
  };
}

/**
 * Creates an empty AppData structure with default values.
 *
 * Used for initialization when no existing data is found,
 * or when data recovery fails completely.
 *
 * @returns Empty AppData with latest schema version
 *
 * @example
 * const emptyData = createEmptyData();
 * // Returns: { schemaVersion: 1, tasks: [] }
 */
export function createEmptyData(): AppData {
  logger.debug('Creating empty data structure');

  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    tasks: [],
  };
}

// ============================================================================
// HELPER FUNCTIONS (Internal)
// ============================================================================

/**
 * Loads data from backup storage.
 *
 * Internal helper function used when primary storage fails.
 * Attempts to load from APP_DATA_BACKUP key.
 *
 * @returns Promise resolving to AppData (empty if backup also fails)
 */
async function loadFromBackup(): Promise<AppData> {
  try {
    logger.info('Attempting to load from backup');

    const parsedBackup = await loadEncrypted<AppData>(BACKUP_KEY);

    if (!parsedBackup) {
      logger.warn('No backup data found');
      return createEmptyData();
    }

    if (!isValidAppData(parsedBackup)) {
      logger.error('Backup data validation failed');
      return createEmptyData();
    }

    logger.info('Backup data loaded successfully', {
      taskCount: parsedBackup.tasks.length,
    });

    // Migrate backup data if needed
    return migrateSchema(parsedBackup);
  } catch (error) {
    logger.error('Failed to load backup data', error as Error);
    return createEmptyData();
  }
}

/**
 * Performs the actual save operation with retry logic.
 *
 * Internal helper function that handles:
 * - JSON serialization
 * - Saving to both primary and backup storage
 * - Retry on failure (1 retry)
 *
 * @param data - AppData to save
 * @throws {AppError} If save fails after retry
 */
async function performSave(data: AppData): Promise<void> {
  let lastError: Error | null = null;

  // Try saving with retry
  for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        logger.warn('Retrying save operation', { attempt });
      }

      // Save to both primary and backup storage (encrypted)
      await Promise.all([saveEncrypted(STORAGE_KEY, data), saveEncrypted(BACKUP_KEY, data)]);

      logger.debug('Data saved to storage and backup');
      return; // Success!
    } catch (error) {
      lastError = error as Error;
      logger.error(`Save attempt ${attempt + 1} failed`, lastError);

      // If this was the last retry, throw error
      if (attempt === MAX_SAVE_RETRIES) {
        const appError = createAppError(ErrorCode.UNKNOWN, '데이터 저장에 실패했습니다', lastError);
        logAppError(appError);
        throw appError;
      }

      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Should never reach here, but just in case
  throw createAppError(ErrorCode.UNKNOWN, '데이터 저장에 실패했습니다', lastError || undefined);
}

/**
 * Migrates data from schema v0 to v1.
 *
 * Initial schema version (v1):
 * - Adds schemaVersion field to AppData
 * - Ensures all tasks have createdAt and updatedAt timestamps
 * - Ensures all tasks have schemaVersion field
 *
 * @param data - Data in v0 format (or unknown format)
 * @returns Data in v1 format
 */
function migrateToV1(data: any): AppData {
  logger.debug('Migrating to schema v1');

  const now = new Date().toISOString();

  // Ensure tasks array exists
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];

  // Migrate each task
  const migratedTasks = tasks.map((task: any) => {
    return {
      ...task,
      // Ensure timestamps exist
      createdAt: task.createdAt || now,
      updatedAt: task.updatedAt || now,
      // Ensure task has schema version
      schemaVersion: task.schemaVersion || 1,
      // Ensure items array exists
      items: Array.isArray(task.items) ? task.items : [],
    };
  });

  return {
    schemaVersion: 1,
    tasks: migratedTasks,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Export constants for testing and external use
 */
export const STORAGE_CONSTANTS = {
  STORAGE_KEY,
  BACKUP_KEY,
  MAX_STORAGE_SIZE,
  LATEST_SCHEMA_VERSION,
  CLEANUP_THRESHOLD_DAYS,
  MAX_SAVE_RETRIES,
};
