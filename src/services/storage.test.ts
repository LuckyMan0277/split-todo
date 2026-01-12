/**
 * Storage Service Test Suite
 *
 * Comprehensive tests for the AsyncStorage service layer.
 * Tests all major functionality including load, save, backup, migration, and cleanup.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadAppData,
  saveAppData,
  migrateSchema,
  cleanOldCompletedTasks,
  createEmptyData,
  STORAGE_CONSTANTS,
} from './storage';
import { AppData, Task, ErrorCode } from '../types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Helper function to create a test task
function createTestTask(
  id: string,
  title: string,
  itemCount: number = 0,
  doneCount: number = 0,
  updatedAt?: string
): Task {
  const items = Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    title: `Item ${i}`,
    done: i < doneCount,
  }));

  return {
    id,
    title,
    items,
    createdAt: '2025-11-06T00:00:00.000Z',
    updatedAt: updatedAt || '2025-11-06T00:00:00.000Z',
    schemaVersion: 1,
  };
}

describe('Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================================================
  // createEmptyData Tests
  // ========================================================================

  describe('createEmptyData', () => {
    it('should create empty data with latest schema version', () => {
      const result = createEmptyData();

      expect(result).toEqual({
        schemaVersion: STORAGE_CONSTANTS.LATEST_SCHEMA_VERSION,
        tasks: [],
      });
    });

    it('should have valid AppData structure', () => {
      const result = createEmptyData();

      expect(result).toHaveProperty('schemaVersion');
      expect(result).toHaveProperty('tasks');
      expect(Array.isArray(result.tasks)).toBe(true);
    });
  });

  // ========================================================================
  // loadAppData Tests
  // ========================================================================

  describe('loadAppData', () => {
    it('should return empty data when no data exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_CONSTANTS.STORAGE_KEY);
    });

    it('should load and parse valid data', async () => {
      const testData: AppData = {
        schemaVersion: 1,
        tasks: [createTestTask('1', 'Test Task', 3, 1)],
      };

      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(testData));

      const result = await loadAppData();

      expect(result).toEqual(testData);
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].title).toBe('Test Task');
    });

    it('should fallback to backup when primary data is corrupted', async () => {
      const validBackupData: AppData = {
        schemaVersion: 1,
        tasks: [createTestTask('1', 'Backup Task')],
      };

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('{ invalid json }') // Primary fails
        .mockResolvedValueOnce(JSON.stringify(validBackupData)); // Backup succeeds

      const result = await loadAppData();

      expect(result).toEqual(validBackupData);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledTimes(2);
      expect(mockAsyncStorage.getItem).toHaveBeenNthCalledWith(1, STORAGE_CONSTANTS.STORAGE_KEY);
      expect(mockAsyncStorage.getItem).toHaveBeenNthCalledWith(2, STORAGE_CONSTANTS.BACKUP_KEY);
    });

    it('should return empty data when both primary and backup fail', async () => {
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('{ invalid json }') // Primary fails
        .mockResolvedValueOnce('{ also invalid }'); // Backup fails

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error('AsyncStorage error'));

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });
  });

  // ========================================================================
  // saveAppData Tests
  // ========================================================================

  describe('saveAppData', () => {
    it('should save data to both primary and backup storage', async () => {
      const testData: AppData = {
        schemaVersion: 1,
        tasks: [createTestTask('1', 'Test Task')],
      };

      mockAsyncStorage.multiSet.mockResolvedValue();

      await saveAppData(testData);

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledWith([
        [STORAGE_CONSTANTS.STORAGE_KEY, JSON.stringify(testData)],
        [STORAGE_CONSTANTS.BACKUP_KEY, JSON.stringify(testData)],
      ]);
    });

    it('should retry once on save failure', async () => {
      const testData = createEmptyData();

      mockAsyncStorage.multiSet
        .mockRejectedValueOnce(new Error('First attempt fails'))
        .mockResolvedValueOnce(); // Second attempt succeeds

      await saveAppData(testData);

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledTimes(2);
    });

    it('should throw error after retry fails', async () => {
      const testData = createEmptyData();

      mockAsyncStorage.multiSet.mockRejectedValue(new Error('Persistent failure'));

      await expect(saveAppData(testData)).rejects.toMatchObject({
        code: ErrorCode.UNKNOWN,
      });

      expect(mockAsyncStorage.multiSet).toHaveBeenCalledTimes(
        STORAGE_CONSTANTS.MAX_SAVE_RETRIES + 1
      );
    });

    it('should auto-cleanup when storage size exceeds limit', async () => {
      // Create data that exceeds 5MB (simulate with many tasks)
      const hugeTasks = Array.from({ length: 1000 }, (_, i) =>
        createTestTask(`task-${i}`, `Task ${i}`, 50, 0)
      );

      const hugeData: AppData = {
        schemaVersion: 1,
        tasks: hugeTasks,
      };

      mockAsyncStorage.multiSet.mockResolvedValue();

      // This should trigger auto-cleanup
      await saveAppData(hugeData);

      // Verify that data was saved (possibly after cleanup)
      expect(mockAsyncStorage.multiSet).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // migrateSchema Tests
  // ========================================================================

  describe('migrateSchema', () => {
    it('should not modify data already at latest version', () => {
      const testData: AppData = {
        schemaVersion: STORAGE_CONSTANTS.LATEST_SCHEMA_VERSION,
        tasks: [createTestTask('1', 'Test Task')],
      };

      const result = migrateSchema(testData);

      expect(result).toEqual(testData);
    });

    it('should migrate data from v0 to v1', () => {
      const oldData = {
        // No schemaVersion field (v0)
        tasks: [
          {
            id: '1',
            title: 'Old Task',
            items: [],
            // Missing createdAt and updatedAt
          },
        ],
      };

      const result = migrateSchema(oldData);

      expect(result.schemaVersion).toBe(1);
      expect(result.tasks[0]).toHaveProperty('createdAt');
      expect(result.tasks[0]).toHaveProperty('updatedAt');
      expect(result.tasks[0]).toHaveProperty('schemaVersion');
    });

    it('should handle data without tasks array', () => {
      const invalidData = {
        schemaVersion: 0,
        // No tasks field
      };

      const result = migrateSchema(invalidData);

      expect(result.tasks).toEqual([]);
    });
  });

  // ========================================================================
  // cleanOldCompletedTasks Tests
  // ========================================================================

  describe('cleanOldCompletedTasks', () => {
    it('should remove completed tasks older than 30 days', () => {
      const now = new Date();
      const oldDate = new Date(now);
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const tasks = [
        // This should be removed (100% complete and old)
        createTestTask('1', 'Old Completed', 5, 5, oldDate.toISOString()),
        // This should be kept (not old enough)
        createTestTask('2', 'Recent Completed', 5, 5, now.toISOString()),
        // This should be kept (not fully completed)
        createTestTask('3', 'Old Incomplete', 5, 3, oldDate.toISOString()),
      ];

      const data: AppData = {
        schemaVersion: 1,
        tasks,
      };

      const result = cleanOldCompletedTasks(data);

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks.find((t) => t.id === '1')).toBeUndefined();
      expect(result.tasks.find((t) => t.id === '2')).toBeDefined();
      expect(result.tasks.find((t) => t.id === '3')).toBeDefined();
    });

    it('should keep empty tasks', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);

      const tasks = [
        // Empty task should be kept even if old
        createTestTask('1', 'Empty Task', 0, 0, oldDate.toISOString()),
      ];

      const data: AppData = {
        schemaVersion: 1,
        tasks,
      };

      const result = cleanOldCompletedTasks(data);

      expect(result.tasks).toHaveLength(1);
    });

    it('should not remove any tasks if none meet criteria', () => {
      const now = new Date();

      const tasks = [
        createTestTask('1', 'Recent Task 1', 5, 2, now.toISOString()),
        createTestTask('2', 'Recent Task 2', 5, 5, now.toISOString()),
        createTestTask('3', 'Recent Task 3', 5, 0, now.toISOString()),
      ];

      const data: AppData = {
        schemaVersion: 1,
        tasks,
      };

      const result = cleanOldCompletedTasks(data);

      expect(result.tasks).toHaveLength(3);
    });

    it('should handle tasks with no items', () => {
      const data: AppData = {
        schemaVersion: 1,
        tasks: [createTestTask('1', 'No Items', 0, 0)],
      };

      const result = cleanOldCompletedTasks(data);

      expect(result.tasks).toHaveLength(1);
    });
  });

  // ========================================================================
  // Integration Tests
  // ========================================================================

  describe('Integration: Save and Load', () => {
    it('should successfully save and load data', async () => {
      const originalData: AppData = {
        schemaVersion: 1,
        tasks: [createTestTask('1', 'Task 1', 3, 1), createTestTask('2', 'Task 2', 5, 5)],
      };

      // Save
      mockAsyncStorage.multiSet.mockResolvedValue();
      await saveAppData(originalData);

      // Load
      const savedData = mockAsyncStorage.multiSet.mock.calls[0][0];
      const primaryData = savedData.find(([key]) => key === STORAGE_CONSTANTS.STORAGE_KEY);

      if (primaryData) {
        mockAsyncStorage.getItem.mockResolvedValue(primaryData[1]);
      }

      const loadedData = await loadAppData();

      expect(loadedData).toEqual(originalData);
      expect(loadedData.tasks).toHaveLength(2);
    });

    it('should handle save-load cycle with large data', async () => {
      const largeTasks = Array.from({ length: 100 }, (_, i) =>
        createTestTask(`task-${i}`, `Task ${i}`, 10, 5)
      );

      const largeData: AppData = {
        schemaVersion: 1,
        tasks: largeTasks,
      };

      mockAsyncStorage.multiSet.mockResolvedValue();
      await saveAppData(largeData);

      const savedData = mockAsyncStorage.multiSet.mock.calls[0][0];
      const primaryData = savedData.find(([key]) => key === STORAGE_CONSTANTS.STORAGE_KEY);

      if (primaryData) {
        mockAsyncStorage.getItem.mockResolvedValue(primaryData[1]);
      }

      const loadedData = await loadAppData();

      expect(loadedData.tasks).toHaveLength(100);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle null data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });

    it('should handle undefined data gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(undefined as any);

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });

    it('should handle empty string data', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('');

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });

    it('should handle malformed JSON gracefully', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('{incomplete').mockResolvedValueOnce(null);

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });

    it('should handle data with missing required fields', async () => {
      const invalidData = {
        // Missing schemaVersion
        tasks: 'not an array',
      };

      mockAsyncStorage.getItem
        .mockResolvedValueOnce(JSON.stringify(invalidData))
        .mockResolvedValueOnce(null);

      const result = await loadAppData();

      expect(result).toEqual(createEmptyData());
    });
  });
});
