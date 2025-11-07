/**
 * Backup and Restore Service Module
 *
 * Provides functionality to export app data as JSON files and import backup files.
 * Supports sharing backup files through the native share sheet and validating
 * backup file integrity before restoration.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AppData, ErrorCode } from '../types';
import { isValidAppData } from '../utils/validation';
import { createAppError } from '../utils/errors';
import { logger } from '../utils/logger';

// @ts-ignore - expo-file-system types are incomplete
const { documentDirectory } = FileSystem;

/**
 * Exports app data as a JSON file and opens the share sheet.
 *
 * Creates a formatted JSON backup file with timestamp in the filename,
 * saves it to the document directory, and opens the native share sheet
 * to allow users to save or share the backup file.
 *
 * @param appData - The complete application data to export
 * @returns Promise resolving to the file path where backup was saved
 * @throws AppError with code PERMISSION_DENIED if file system access is denied
 * @throws AppError with code UNKNOWN for other file system or sharing errors
 *
 * @example
 * const appData = { schemaVersion: 1, tasks: [...] };
 * const filePath = await exportData(appData);
 * console.log('Backup saved to:', filePath);
 * // Output: Backup saved to: /path/to/documents/split-todo-backup-2025-11-06-120000.json
 *
 * @example
 * // Handle errors during export
 * try {
 *   const filePath = await exportData(appData);
 *   showToast('success', '백업 파일이 저장되었습니다');
 * } catch (error) {
 *   if (isAppError(error) && error.code === ErrorCode.PERMISSION_DENIED) {
 *     showToast('error', '파일 저장 권한이 필요합니다');
 *   } else {
 *     showToast('error', '백업 실패');
 *   }
 * }
 *
 * @example
 * // User cancels share sheet (not an error)
 * try {
 *   await exportData(appData);
 * } catch (error) {
 *   // Share was cancelled by user, this is normal behavior
 *   logger.debug('User cancelled share sheet');
 * }
 */
export async function exportData(appData: AppData): Promise<string> {
  const timer = logger.startTimer('Export data');

  try {
    logger.debug('Starting data export', {
      taskCount: appData.tasks.length,
      schemaVersion: appData.schemaVersion,
    });

    // Generate filename with timestamp
    // Format: split-todo-backup-YYYY-MM-DD-HHMMSS.json
    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, '')
      .replace(/\..+/, '')
      .replace('T', '-');
    const filename = `split-todo-backup-${timestamp}.json`;

    // Convert AppData to JSON with pretty print (indent: 2)
    const jsonContent = JSON.stringify(appData, null, 2);

    // Determine file path (documentDirectory for iOS/Android compatibility)
    const filePath = `${documentDirectory}${filename}`;

    logger.debug('Writing backup file', { filePath, size: jsonContent.length });

    // Write JSON content to file
    await FileSystem.writeAsStringAsync(filePath, jsonContent);

    logger.debug('Backup file written successfully', { filePath });

    // Open share sheet to allow user to save/share the backup
    try {
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        logger.warn('Sharing is not available on this device');
        throw createAppError(
          ErrorCode.UNKNOWN,
          '이 기기에서는 공유 기능을 사용할 수 없습니다'
        );
      }

      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Split TODO 백업 파일 저장',
        UTI: 'public.json',
      });

      logger.info('Backup exported successfully', { filename, filePath });
    } catch (shareError: any) {
      // Sharing error
      logger.error('Share sheet error', shareError);
      throw createAppError(
        ErrorCode.UNKNOWN,
        '공유 기능을 열 수 없습니다',
        shareError
      );
    }

    timer.end();
    return filePath;
  } catch (error: any) {
    timer.end();

    // Check if it's already an AppError
    if (error.code && Object.values(ErrorCode).includes(error.code)) {
      throw error;
    }

    // Handle permission denied errors
    if (
      error.message &&
      (error.message.includes('permission') ||
        error.message.includes('PERMISSION') ||
        error.message.includes('denied'))
    ) {
      logger.error('File permission denied', error);
      throw createAppError(
        ErrorCode.PERMISSION_DENIED,
        '파일 저장 권한이 필요합니다',
        error
      );
    }

    // Handle other file system errors
    logger.error('Export failed', error);
    throw createAppError(
      ErrorCode.UNKNOWN,
      '백업 파일 생성에 실패했습니다',
      error
    );
  }
}

/**
 * Imports app data from a JSON backup file.
 *
 * Reads a backup file from the given file path, parses the JSON content,
 * validates the data structure, and returns the parsed AppData if valid.
 *
 * @param filePath - The absolute file path to the backup JSON file
 * @returns Promise resolving to the validated AppData from the backup file
 * @throws AppError with code INVALID_BACKUP if file is not valid JSON or fails validation
 * @throws AppError with code PERMISSION_DENIED if file cannot be read due to permissions
 * @throws AppError with code UNKNOWN for other file system errors
 *
 * @example
 * const filePath = '/path/to/split-todo-backup-2025-11-06-120000.json';
 * const appData = await importData(filePath);
 * console.log('Imported tasks:', appData.tasks.length);
 * // Output: Imported tasks: 25
 *
 * @example
 * // Handle import errors
 * try {
 *   const appData = await importData(selectedFilePath);
 *   // Restore the data to store
 *   store.setState({ tasks: appData.tasks });
 *   showToast('success', '백업을 복원했습니다');
 * } catch (error) {
 *   if (isAppError(error) && error.code === ErrorCode.INVALID_BACKUP) {
 *     showToast('error', '올바른 백업 파일이 아닙니다');
 *   } else {
 *     showToast('error', '백업 복원에 실패했습니다');
 *   }
 * }
 *
 * @example
 * // Validate before importing
 * async function safeImport(filePath: string) {
 *   try {
 *     const appData = await importData(filePath);
 *
 *     // Additional checks
 *     if (appData.tasks.length === 0) {
 *       logger.warn('Backup file contains no tasks');
 *     }
 *
 *     return appData;
 *   } catch (error) {
 *     logger.error('Import failed', error);
 *     throw error;
 *   }
 * }
 */
export async function importData(filePath: string): Promise<AppData> {
  const timer = logger.startTimer('Import data');

  try {
    logger.debug('Starting data import', { filePath });

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일을 찾을 수 없습니다'
      );
    }

    // Read file content
    logger.debug('Reading backup file');
    const fileContent = await FileSystem.readAsStringAsync(filePath);

    logger.debug('Backup file read successfully', {
      contentLength: fileContent.length,
    });

    // Parse JSON content
    let parsedData: any;
    try {
      parsedData = JSON.parse(fileContent);
    } catch (parseError) {
      logger.error('JSON parse failed', parseError as Error);
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일 형식이 올바르지 않습니다',
        parseError as Error
      );
    }

    logger.debug('JSON parsed successfully', {
      schemaVersion: parsedData?.schemaVersion,
      taskCount: parsedData?.tasks?.length,
    });

    // Validate backup file structure
    const isValid = validateBackupFile(parsedData);

    if (!isValid) {
      logger.error('Backup file validation failed');
      logger.debug('Invalid backup data', parsedData);
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일 데이터가 유효하지 않습니다'
      );
    }

    logger.info('Backup imported successfully', {
      taskCount: parsedData.tasks.length,
      schemaVersion: parsedData.schemaVersion,
    });

    timer.end();
    return parsedData as AppData;
  } catch (error: any) {
    timer.end();

    // Check if it's already an AppError
    if (error.code && Object.values(ErrorCode).includes(error.code)) {
      throw error;
    }

    // Handle permission denied errors
    if (
      error.message &&
      (error.message.includes('permission') ||
        error.message.includes('PERMISSION') ||
        error.message.includes('denied'))
    ) {
      logger.error('File permission denied', error);
      throw createAppError(
        ErrorCode.PERMISSION_DENIED,
        '파일 읽기 권한이 필요합니다',
        error
      );
    }

    // Handle file not found errors
    if (
      error.message &&
      (error.message.includes('ENOENT') ||
        error.message.includes('not found') ||
        error.message.includes('No such file'))
    ) {
      logger.error('File not found', error);
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일을 찾을 수 없습니다',
        error
      );
    }

    // Handle other errors
    logger.error('Import failed', error);
    throw createAppError(
      ErrorCode.UNKNOWN,
      '백업 파일을 가져올 수 없습니다',
      error
    );
  }
}

/**
 * Validates the structure and content of a backup file.
 *
 * Performs comprehensive validation to ensure the data conforms to the
 * AppData interface and contains valid tasks. Uses the isValidAppData
 * type guard for runtime validation.
 *
 * @param data - The parsed backup data to validate
 * @returns True if the data is valid AppData, false otherwise
 *
 * @example
 * const validData = {
 *   schemaVersion: 1,
 *   tasks: [
 *     {
 *       id: '123',
 *       title: 'Task 1',
 *       items: [],
 *       createdAt: '2025-11-06T00:00:00.000Z',
 *       updatedAt: '2025-11-06T00:00:00.000Z',
 *     },
 *   ],
 * };
 * validateBackupFile(validData);
 * // Returns: true
 *
 * @example
 * // Missing schemaVersion
 * const invalidData = { tasks: [] };
 * validateBackupFile(invalidData);
 * // Returns: false
 *
 * @example
 * // Tasks is not an array
 * const invalidData = { schemaVersion: 1, tasks: 'not an array' };
 * validateBackupFile(invalidData);
 * // Returns: false
 *
 * @example
 * // Invalid task structure
 * const invalidData = {
 *   schemaVersion: 1,
 *   tasks: [{ id: '123' }], // Missing required fields
 * };
 * validateBackupFile(invalidData);
 * // Returns: false
 *
 * @example
 * // Use in import flow
 * async function importBackup(filePath: string) {
 *   const content = await FileSystem.readAsStringAsync(filePath);
 *   const data = JSON.parse(content);
 *
 *   if (!validateBackupFile(data)) {
 *     throw new Error('Invalid backup file');
 *   }
 *
 *   // Safe to use as AppData
 *   return data as AppData;
 * }
 */
export function validateBackupFile(data: any): boolean {
  try {
    // Check if data exists and is an object
    if (!data || typeof data !== 'object') {
      logger.debug('Validation failed: data is not an object', { data });
      return false;
    }

    // Check schemaVersion exists and is a number
    if (typeof data.schemaVersion !== 'number' || data.schemaVersion < 1) {
      logger.debug('Validation failed: invalid schemaVersion', {
        schemaVersion: data.schemaVersion,
      });
      return false;
    }

    // Check tasks exists and is an array
    if (!Array.isArray(data.tasks)) {
      logger.debug('Validation failed: tasks is not an array', {
        tasks: data.tasks,
      });
      return false;
    }

    // Use the comprehensive type guard from validation utils
    const isValid = isValidAppData(data);

    if (!isValid) {
      logger.debug('Validation failed: isValidAppData returned false');
      return false;
    }

    logger.debug('Backup file validation passed', {
      schemaVersion: data.schemaVersion,
      taskCount: data.tasks.length,
    });

    return true;
  } catch (error) {
    logger.error('Validation error', error as Error);
    return false;
  }
}

/**
 * Cleans up a backup file from the file system.
 *
 * Deletes a backup file to free up storage space. Should be called
 * after successfully sharing or when cleaning up temporary files.
 *
 * @param filePath - The absolute file path to delete
 * @returns Promise resolving to true if deleted, false if file didn't exist
 * @throws AppError with code PERMISSION_DENIED if file cannot be deleted due to permissions
 *
 * @example
 * const filePath = await exportData(appData);
 * // ... after sharing ...
 * await cleanupBackupFile(filePath);
 * console.log('Temporary backup file deleted');
 *
 * @example
 * // Safe cleanup with error handling
 * try {
 *   await cleanupBackupFile(filePath);
 * } catch (error) {
 *   // Non-critical error, just log it
 *   logger.warn('Failed to cleanup backup file', { filePath });
 * }
 */
export async function cleanupBackupFile(filePath: string): Promise<boolean> {
  try {
    logger.debug('Cleaning up backup file', { filePath });

    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      logger.debug('Backup file does not exist, nothing to clean up');
      return false;
    }

    // Delete the file
    await FileSystem.deleteAsync(filePath, { idempotent: true });

    logger.debug('Backup file deleted successfully', { filePath });
    return true;
  } catch (error: any) {
    // Handle permission errors
    if (
      error.message &&
      (error.message.includes('permission') ||
        error.message.includes('PERMISSION') ||
        error.message.includes('denied'))
    ) {
      logger.error('File permission denied during cleanup', error);
      throw createAppError(
        ErrorCode.PERMISSION_DENIED,
        '파일 삭제 권한이 필요합니다',
        error
      );
    }

    // For other errors, log but don't throw (cleanup is not critical)
    logger.warn('Failed to cleanup backup file', { filePath, error });
    return false;
  }
}

/**
 * Gets information about a backup file.
 *
 * Reads a backup file and returns metadata without fully importing it.
 * Useful for displaying backup file information before restoration.
 *
 * @param filePath - The absolute file path to the backup file
 * @returns Promise resolving to backup metadata
 * @throws AppError if file cannot be read or parsed
 *
 * @example
 * const info = await getBackupInfo('/path/to/backup.json');
 * console.log(`Backup contains ${info.taskCount} tasks`);
 * console.log(`Created: ${info.createdAt}`);
 * console.log(`Schema version: ${info.schemaVersion}`);
 *
 * @example
 * // Display backup info before importing
 * async function confirmImport(filePath: string) {
 *   try {
 *     const info = await getBackupInfo(filePath);
 *     const confirmed = await showConfirmDialog(
 *       `${info.taskCount}개의 할 일을 복원하시겠습니까?`
 *     );
 *     if (confirmed) {
 *       await importData(filePath);
 *     }
 *   } catch (error) {
 *     showToast('error', '백업 파일 정보를 읽을 수 없습니다');
 *   }
 * }
 */
export async function getBackupInfo(filePath: string): Promise<{
  schemaVersion: number;
  taskCount: number;
  totalItems: number;
  fileSize: number;
  fileName: string;
}> {
  try {
    logger.debug('Getting backup file info', { filePath });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일을 찾을 수 없습니다'
      );
    }

    // Read and parse file
    const fileContent = await FileSystem.readAsStringAsync(filePath);
    const data = JSON.parse(fileContent);

    // Validate basic structure
    if (!validateBackupFile(data)) {
      throw createAppError(
        ErrorCode.INVALID_BACKUP,
        '백업 파일이 유효하지 않습니다'
      );
    }

    // Calculate total items across all tasks
    const totalItems = data.tasks.reduce(
      (sum: number, task: any) => sum + (task.items?.length || 0),
      0
    );

    const info = {
      schemaVersion: data.schemaVersion,
      taskCount: data.tasks.length,
      totalItems,
      fileSize: fileInfo.size || 0,
      fileName: filePath.split('/').pop() || 'unknown',
    };

    logger.debug('Backup file info retrieved', info);
    return info;
  } catch (error: any) {
    // Check if it's already an AppError
    if (error.code && Object.values(ErrorCode).includes(error.code)) {
      throw error;
    }

    logger.error('Failed to get backup info', error);
    throw createAppError(
      ErrorCode.INVALID_BACKUP,
      '백업 파일 정보를 읽을 수 없습니다',
      error
    );
  }
}
