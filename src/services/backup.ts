/**
 * Backup and Restore Service Module
 *
 * Provides functionality to export app data as JSON files.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AppData, ErrorCode } from '../types';
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
        throw createAppError(ErrorCode.UNKNOWN, '이 기기에서는 공유 기능을 사용할 수 없습니다');
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
      throw createAppError(ErrorCode.UNKNOWN, '공유 기능을 열 수 없습니다', shareError);
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
      throw createAppError(ErrorCode.PERMISSION_DENIED, '파일 저장 권한이 필요합니다', error);
    }

    // Handle other file system errors
    logger.error('Export failed', error);
    throw createAppError(ErrorCode.UNKNOWN, '백업 파일 생성에 실패했습니다', error);
  }
}
