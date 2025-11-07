/**
 * Validation Utility Module
 *
 * Provides comprehensive validation functions for user input,
 * data integrity checks, and storage limit enforcement.
 */

import { ValidationResult, Task, ChecklistItem, AppData } from '../types';

// Constants for validation limits
const MIN_TITLE_LENGTH = 1;
const MAX_TITLE_LENGTH = 120;
const MAX_TASK_COUNT = 200; // Updated from 1000 to 200 based on AsyncStorage limitations
const MAX_ITEM_COUNT = 50;  // Updated from 200 to 50 based on AsyncStorage limitations
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

/**
 * Validates a title string for tasks or checklist items.
 *
 * Checks if the title meets length requirements after normalization.
 * Title must be between 1-120 characters (inclusive) after trimming.
 *
 * @param title - The title string to validate
 * @returns ValidationResult indicating if title is valid with error details
 *
 * @example
 * validateTitle('Website Redesign');
 * // Returns: { valid: true }
 *
 * @example
 * validateTitle('');
 * // Returns: { valid: false, error: '제목을 입력해주세요' }
 *
 * @example
 * validateTitle('   ');
 * // Returns: { valid: false, error: '제목을 입력해주세요' }
 *
 * @example
 * validateTitle('a'.repeat(150));
 * // Returns: { valid: false, error: '제목은 120자 이하로 입력해주세요', details: '현재: 150자' }
 */
export function validateTitle(title: string): ValidationResult {
  const normalized = normalizeTitle(title);

  // Check for empty title
  if (normalized.length < MIN_TITLE_LENGTH) {
    return {
      valid: false,
      error: '제목을 입력해주세요',
    };
  }

  // Check for title too long
  if (normalized.length > MAX_TITLE_LENGTH) {
    return {
      valid: false,
      error: `제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해주세요`,
      details: `현재: ${normalized.length}자`,
    };
  }

  return { valid: true };
}

/**
 * Normalizes a title string by trimming whitespace and removing newlines.
 *
 * Ensures consistent title formatting across the application by:
 * - Trimming leading and trailing whitespace
 * - Removing all newline characters (\n, \r)
 * - Collapsing multiple spaces into single spaces
 *
 * @param title - The title string to normalize
 * @returns Normalized title string
 *
 * @example
 * normalizeTitle('  Hello World  ');
 * // Returns: 'Hello World'
 *
 * @example
 * normalizeTitle('Line 1\nLine 2');
 * // Returns: 'Line 1 Line 2'
 *
 * @example
 * normalizeTitle('Too   Many    Spaces');
 * // Returns: 'Too Many Spaces'
 *
 * @example
 * normalizeTitle('\r\n  Messy   Input\n\n  ');
 * // Returns: 'Messy Input'
 */
export function normalizeTitle(title: string): string {
  return title
    .trim()                           // Remove leading/trailing whitespace
    .replace(/[\r\n]+/g, ' ')        // Replace newlines with spaces
    .replace(/\s+/g, ' ');           // Collapse multiple spaces
}

/**
 * Checks if the task count is within the allowed limit.
 *
 * Validates against the maximum task count limit (200 tasks).
 * Provides warning when approaching the limit and error when exceeded.
 *
 * @param count - Current number of tasks
 * @returns ValidationResult with error if limit exceeded
 *
 * @example
 * checkTaskLimit(100);
 * // Returns: { valid: true }
 *
 * @example
 * checkTaskLimit(180);
 * // Returns: { valid: true, details: '할 일이 200개에 가까워지고 있습니다. 완료된 항목을 정리하는 것을 권장합니다.' }
 *
 * @example
 * checkTaskLimit(200);
 * // Returns: { valid: false, error: '최대 200개의 할 일만 생성할 수 있습니다', details: '완료된 할 일을 삭제하거나 백업 후 초기화하세요' }
 *
 * @example
 * checkTaskLimit(250);
 * // Returns: { valid: false, error: '최대 200개의 할 일만 생성할 수 있습니다', details: '완료된 할 일을 삭제하거나 백업 후 초기화하세요' }
 */
export function checkTaskLimit(count: number): ValidationResult {
  if (count >= MAX_TASK_COUNT) {
    return {
      valid: false,
      error: `최대 ${MAX_TASK_COUNT}개의 할 일만 생성할 수 있습니다`,
      details: '완료된 할 일을 삭제하거나 백업 후 초기화하세요',
    };
  }

  // Warning when approaching limit (90% threshold)
  if (count >= MAX_TASK_COUNT * 0.9) {
    return {
      valid: true,
      details: `할 일이 ${MAX_TASK_COUNT}개에 가까워지고 있습니다. 완료된 항목을 정리하는 것을 권장합니다.`,
    };
  }

  return { valid: true };
}

/**
 * Checks if the checklist item count is within the allowed limit.
 *
 * Validates against the maximum item count per task (50 items).
 * Provides warning when approaching the limit and error when exceeded.
 *
 * @param count - Current number of checklist items in a task
 * @returns ValidationResult with error if limit exceeded
 *
 * @example
 * checkItemLimit(10);
 * // Returns: { valid: true }
 *
 * @example
 * checkItemLimit(45);
 * // Returns: { valid: true, details: '체크리스트 항목이 50개에 가까워지고 있습니다.' }
 *
 * @example
 * checkItemLimit(50);
 * // Returns: { valid: false, error: '최대 50개의 항목만 추가할 수 있습니다', details: '더 세분화된 작업은 새로운 할 일로 분리하세요' }
 *
 * @example
 * checkItemLimit(100);
 * // Returns: { valid: false, error: '최대 50개의 항목만 추가할 수 있습니다', details: '더 세분화된 작업은 새로운 할 일로 분리하세요' }
 */
export function checkItemLimit(count: number): ValidationResult {
  if (count >= MAX_ITEM_COUNT) {
    return {
      valid: false,
      error: `최대 ${MAX_ITEM_COUNT}개의 항목만 추가할 수 있습니다`,
      details: '더 세분화된 작업은 새로운 할 일로 분리하세요',
    };
  }

  // Warning when approaching limit (90% threshold)
  if (count >= MAX_ITEM_COUNT * 0.9) {
    return {
      valid: true,
      details: `체크리스트 항목이 ${MAX_ITEM_COUNT}개에 가까워지고 있습니다.`,
    };
  }

  return { valid: true };
}

/**
 * Type guard to check if data is a valid Task object.
 *
 * Performs runtime validation to ensure an object conforms to the Task interface.
 * Checks for required fields, correct types, and valid data structures.
 *
 * @param data - Data to validate as a Task
 * @returns True if data is a valid Task, false otherwise
 *
 * @example
 * const validTask = {
 *   id: '123',
 *   title: 'My Task',
 *   items: [{ id: '1', title: 'Item 1', done: false }],
 *   createdAt: '2025-11-06T00:00:00.000Z',
 *   updatedAt: '2025-11-06T00:00:00.000Z',
 * };
 * isValidTask(validTask);
 * // Returns: true
 *
 * @example
 * isValidTask({ id: '123' });
 * // Returns: false (missing required fields)
 *
 * @example
 * isValidTask(null);
 * // Returns: false
 */
export function isValidTask(data: any): data is Task {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check required string fields
  if (typeof data.id !== 'string' || !data.id) {
    return false;
  }

  if (typeof data.title !== 'string' || !data.title) {
    return false;
  }

  if (typeof data.createdAt !== 'string' || !data.createdAt) {
    return false;
  }

  if (typeof data.updatedAt !== 'string' || !data.updatedAt) {
    return false;
  }

  // Check items array
  if (!Array.isArray(data.items)) {
    return false;
  }

  // Validate each item in the array
  if (!data.items.every((item: any) => isValidChecklistItem(item))) {
    return false;
  }

  // schemaVersion is optional
  if (data.schemaVersion !== undefined && typeof data.schemaVersion !== 'number') {
    return false;
  }

  return true;
}

/**
 * Type guard to check if data is a valid ChecklistItem object.
 *
 * Performs runtime validation to ensure an object conforms to the ChecklistItem interface.
 *
 * @param data - Data to validate as a ChecklistItem
 * @returns True if data is a valid ChecklistItem, false otherwise
 *
 * @example
 * const validItem = { id: '1', title: 'Step 1', done: false };
 * isValidChecklistItem(validItem);
 * // Returns: true
 *
 * @example
 * isValidChecklistItem({ id: '1', title: 'Step 1' });
 * // Returns: false (missing 'done' field)
 *
 * @example
 * isValidChecklistItem({ id: 1, title: 'Step 1', done: false });
 * // Returns: false (id must be string)
 */
export function isValidChecklistItem(data: any): data is ChecklistItem {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (typeof data.id !== 'string' || !data.id) {
    return false;
  }

  if (typeof data.title !== 'string' || !data.title) {
    return false;
  }

  if (typeof data.done !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Type guard to check if data is a valid AppData object.
 *
 * Performs runtime validation to ensure an object conforms to the AppData interface.
 * Validates the schema version and all tasks in the tasks array.
 *
 * @param data - Data to validate as AppData
 * @returns True if data is a valid AppData object, false otherwise
 *
 * @example
 * const validAppData = {
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
 * isValidAppData(validAppData);
 * // Returns: true
 *
 * @example
 * isValidAppData({ tasks: [] });
 * // Returns: false (missing schemaVersion)
 *
 * @example
 * isValidAppData({ schemaVersion: 1, tasks: 'not an array' });
 * // Returns: false (tasks must be array)
 */
export function isValidAppData(data: any): data is AppData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check schema version
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion < 1) {
    return false;
  }

  // Check tasks array
  if (!Array.isArray(data.tasks)) {
    return false;
  }

  // Validate each task in the array
  if (!data.tasks.every((task: any) => isValidTask(task))) {
    return false;
  }

  return true;
}

/**
 * Calculates the storage size of data in bytes.
 *
 * Estimates the storage size by serializing the data to JSON and
 * calculating the byte length. Uses Blob API for accurate measurement
 * in browsers, falls back to string length calculation.
 *
 * @param data - Data to measure (will be JSON serialized)
 * @returns Size in bytes
 *
 * @example
 * const task = {
 *   id: '123',
 *   title: 'My Task',
 *   items: [],
 *   createdAt: '2025-11-06T00:00:00.000Z',
 *   updatedAt: '2025-11-06T00:00:00.000Z',
 * };
 * calculateStorageSize(task);
 * // Returns: ~150 (approximate bytes)
 *
 * @example
 * const appData = { schemaVersion: 1, tasks: [] };
 * calculateStorageSize(appData);
 * // Returns: ~30 (approximate bytes)
 */
export function calculateStorageSize(data: any): number {
  try {
    const jsonString = JSON.stringify(data);

    // Try using Blob API for accurate byte size (browser/modern environment)
    if (typeof Blob !== 'undefined') {
      return new Blob([jsonString]).size;
    }

    // Fallback: estimate using string length
    // This is less accurate for Unicode characters but works in all environments
    // UTF-8 encoding: 1 byte for ASCII, up to 4 bytes for other characters
    // We use a conservative estimate of 2 bytes per character
    return jsonString.length * 2;
  } catch (error) {
    // If serialization fails, return 0
    return 0;
  }
}

/**
 * Checks if the storage size is within the allowed limit.
 *
 * Validates against the maximum storage size (5MB).
 * Provides warning when approaching the limit.
 *
 * @param sizeInBytes - Current storage size in bytes
 * @returns ValidationResult with error if limit exceeded
 *
 * @example
 * checkStorageLimit(1024 * 1024); // 1MB
 * // Returns: { valid: true }
 *
 * @example
 * checkStorageLimit(4.5 * 1024 * 1024); // 4.5MB
 * // Returns: { valid: true, details: '저장 공간이 5MB에 가까워지고 있습니다...' }
 *
 * @example
 * checkStorageLimit(6 * 1024 * 1024); // 6MB
 * // Returns: { valid: false, error: '저장 공간이 부족합니다', details: '완료된 할 일을 삭제하거나 백업 후 초기화하세요' }
 */
export function checkStorageLimit(sizeInBytes: number): ValidationResult {
  if (sizeInBytes >= MAX_STORAGE_SIZE) {
    return {
      valid: false,
      error: '저장 공간이 부족합니다',
      details: '완료된 할 일을 삭제하거나 백업 후 초기화하세요',
    };
  }

  // Warning when approaching limit (90% threshold)
  if (sizeInBytes >= MAX_STORAGE_SIZE * 0.9) {
    const percentUsed = Math.round((sizeInBytes / MAX_STORAGE_SIZE) * 100);
    return {
      valid: true,
      details: `저장 공간이 ${MAX_STORAGE_SIZE / 1024 / 1024}MB에 가까워지고 있습니다. (${percentUsed}% 사용 중)`,
    };
  }

  return { valid: true };
}
