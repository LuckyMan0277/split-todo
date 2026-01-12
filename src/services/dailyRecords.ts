/**
 * Daily Records Service
 *
 * Manages daily completion records for the calendar visualization.
 * Records are saved automatically at the configured time (default: midnight).
 * Data is encrypted using platform-native encryption (iOS: Keychain, Android: EncryptedSharedPreferences).
 *
 * Extended to support:
 * - Daily snapshots of completed/incomplete items (past dates)
 * - Scheduled items for future planning (future dates)
 */

import { DailyRecord, DailyRecordsData, DailyRecordItem, Task } from '../types';
import { logger } from '../utils/logger';
import { saveEncrypted, loadEncrypted } from './encryptedStorage';

// Encrypted storage key for daily records
// Note: expo-secure-store only allows alphanumeric, ".", "-", and "_"
const DAILY_RECORDS_KEY = 'split_todo.daily_records';

/**
 * Loads all daily records from encrypted storage.
 */
export const loadDailyRecords = async (): Promise<DailyRecordsData> => {
  try {
    logger.debug('Loading daily records from encrypted storage');

    const data = await loadEncrypted<DailyRecordsData>(DAILY_RECORDS_KEY);

    if (!data) {
      logger.info('No daily records found, returning empty data');
      return {
        schemaVersion: 1,
        records: {},
      };
    }

    // Validate schema version
    if (data.schemaVersion !== 1) {
      logger.warn('Unsupported schema version', { version: data.schemaVersion });
      // In the future, handle migrations here
      return {
        schemaVersion: 1,
        records: {},
      };
    }

    logger.info('Daily records loaded successfully', {
      recordCount: Object.keys(data.records).length,
    });

    return data;
  } catch (error) {
    logger.error('Failed to load daily records', error as Error);
    // Return empty data on error
    return {
      schemaVersion: 1,
      records: {},
    };
  }
};

/**
 * Saves all daily records to encrypted storage.
 */
export const saveDailyRecords = async (data: DailyRecordsData): Promise<void> => {
  try {
    logger.debug('Saving daily records to encrypted storage', {
      recordCount: Object.keys(data.records).length,
    });

    await saveEncrypted(DAILY_RECORDS_KEY, data);

    logger.info('Daily records saved successfully');
  } catch (error) {
    logger.error('Failed to save daily records', error as Error);
    throw error;
  }
};

/**
 * Saves a single daily record for a specific date.
 * If a record already exists for that date, it will be overwritten.
 */
export const saveDailyRecord = async (record: DailyRecord): Promise<void> => {
  try {
    logger.debug('Saving daily record', { date: record.date });

    // Load existing records
    const data = await loadDailyRecords();

    // Add or update the record
    data.records[record.date] = record;

    // Save back to storage
    await saveDailyRecords(data);

    logger.info('Daily record saved successfully', {
      date: record.date,
      completionRate: record.completionRate,
    });
  } catch (error) {
    logger.error('Failed to save daily record', error as Error);
    throw error;
  }
};

/**
 * Gets a daily record for a specific date.
 * Returns undefined if no record exists for that date.
 */
export const getDailyRecord = async (date: string): Promise<DailyRecord | undefined> => {
  try {
    logger.debug('Getting daily record', { date });

    const data = await loadDailyRecords();
    const record = data.records[date];

    if (record) {
      logger.debug('Daily record found', { date, completionRate: record.completionRate });
    } else {
      logger.debug('No record found for date', { date });
    }

    return record;
  } catch (error) {
    logger.error('Failed to get daily record', error as Error);
    return undefined;
  }
};

/**
 * Gets daily records for a range of dates.
 * Returns a map of date strings to records.
 */
export const getDailyRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<Record<string, DailyRecord>> => {
  try {
    logger.debug('Getting daily records range', { startDate, endDate });

    const data = await loadDailyRecords();
    const rangeRecords: Record<string, DailyRecord> = {};

    // Filter records within the date range
    Object.keys(data.records).forEach((date) => {
      if (date >= startDate && date <= endDate) {
        rangeRecords[date] = data.records[date];
      }
    });

    logger.debug('Daily records range retrieved', {
      count: Object.keys(rangeRecords).length,
    });

    return rangeRecords;
  } catch (error) {
    logger.error('Failed to get daily records range', error as Error);
    return {};
  }
};

/**
 * Deletes a daily record for a specific date.
 */
export const deleteDailyRecord = async (date: string): Promise<void> => {
  try {
    logger.debug('Deleting daily record', { date });

    const data = await loadDailyRecords();

    if (data.records[date]) {
      delete data.records[date];
      await saveDailyRecords(data);
      logger.info('Daily record deleted successfully', { date });
    } else {
      logger.warn('No record found to delete', { date });
    }
  } catch (error) {
    logger.error('Failed to delete daily record', error as Error);
    throw error;
  }
};

/**
 * Clears all daily records.
 * USE WITH CAUTION - this operation cannot be undone.
 */
export const clearAllDailyRecords = async (): Promise<void> => {
  try {
    logger.warn('Clearing all daily records');

    const emptyData: DailyRecordsData = {
      schemaVersion: 1,
      records: {},
    };

    await saveDailyRecords(emptyData);

    logger.info('All daily records cleared successfully');
  } catch (error) {
    logger.error('Failed to clear daily records', error as Error);
    throw error;
  }
};

/**
 * Formats a Date object to YYYY-MM-DD string (local timezone).
 */
export const formatDateToKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Gets today's date key in YYYY-MM-DD format.
 */
export const getTodayKey = (): string => {
  return formatDateToKey(new Date());
};

/**
 * Creates a daily record snapshot from current tasks.
 * Captures all items marked as "today" with their current completion status.
 */
export const createDailySnapshot = (date: string, tasks: Task[]): DailyRecord => {
  logger.debug('Creating daily snapshot', { date });

  const items: DailyRecordItem[] = [];
  let order = 0;

  // Collect all items scheduled for this date
  tasks.forEach((task) => {
    task.items.forEach((item) => {
      // Check both scheduledDates (new) and isToday (legacy)
      const scheduledDates = item.scheduledDates || [];
      const isScheduled = scheduledDates.includes(date) || item.isToday === true;

      if (isScheduled) {
        items.push({
          id: item.id,
          taskId: task.id,
          taskTitle: task.title,
          title: item.title,
          done: item.done,
          order: order++,
        });
      }
    });
  });

  // Calculate completion stats
  const completedCount = items.filter((item) => item.done).length;
  const totalCount = items.length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const snapshot: DailyRecord = {
    date,
    completedCount,
    totalCount,
    completionRate,
    savedAt: new Date().toISOString(),
    items,
  };

  logger.info('Daily snapshot created', {
    date,
    totalCount,
    completedCount,
    completionRate,
  });

  return snapshot;
};

/**
 * Saves a daily snapshot for a specific date.
 * This creates a point-in-time record of all "today" items and their completion status.
 */
export const saveDailySnapshot = async (date: string, tasks: Task[]): Promise<void> => {
  try {
    logger.debug('Saving daily snapshot', { date });

    const snapshot = createDailySnapshot(date, tasks);
    await saveDailyRecord(snapshot);

    logger.info('Daily snapshot saved successfully', {
      date,
      itemCount: snapshot.items?.length || 0,
    });
  } catch (error) {
    logger.error('Failed to save daily snapshot', error as Error);
    throw error;
  }
};

/**
 * Schedules items for a future date.
 * Creates or updates a daily record with planned items.
 */
export const scheduleItemsForDate = async (
  date: string,
  items: DailyRecordItem[]
): Promise<void> => {
  try {
    logger.debug('Scheduling items for date', { date, itemCount: items.length });

    const record: DailyRecord = {
      date,
      completedCount: 0,
      totalCount: items.length,
      completionRate: 0,
      savedAt: new Date().toISOString(),
      items,
    };

    await saveDailyRecord(record);

    logger.info('Items scheduled for date', { date, itemCount: items.length });
  } catch (error) {
    logger.error('Failed to schedule items', error as Error);
    throw error;
  }
};

/**
 * Adds a single item to a future date's schedule.
 */
export const addItemToDateSchedule = async (
  date: string,
  item: Omit<DailyRecordItem, 'order'>
): Promise<void> => {
  try {
    logger.debug('Adding item to date schedule', { date, itemId: item.id });

    // Load existing record
    const existingRecord = await getDailyRecord(date);
    const existingItems = existingRecord?.items || [];

    // Check if item already scheduled
    const itemExists = existingItems.some((i) => i.id === item.id);
    if (itemExists) {
      logger.warn('Item already scheduled for this date', { date, itemId: item.id });
      return;
    }

    // Add new item with order
    const newItem: DailyRecordItem = {
      ...item,
      order: existingItems.length,
    };

    const updatedItems = [...existingItems, newItem];

    // Update record
    const record: DailyRecord = {
      date,
      completedCount: 0,
      totalCount: updatedItems.length,
      completionRate: 0,
      savedAt: new Date().toISOString(),
      items: updatedItems,
    };

    await saveDailyRecord(record);

    logger.info('Item added to date schedule', { date, itemId: item.id });
  } catch (error) {
    logger.error('Failed to add item to schedule', error as Error);
    throw error;
  }
};

/**
 * Removes an item from a future date's schedule.
 */
export const removeItemFromDateSchedule = async (date: string, itemId: string): Promise<void> => {
  try {
    logger.debug('Removing item from date schedule', { date, itemId });

    // Load existing record
    const existingRecord = await getDailyRecord(date);
    if (!existingRecord || !existingRecord.items) {
      logger.warn('No schedule found for this date', { date });
      return;
    }

    // Filter out the item
    const updatedItems = existingRecord.items.filter((item) => item.id !== itemId);

    // Re-order remaining items
    updatedItems.forEach((item, index) => {
      item.order = index;
    });

    // Update or delete record
    if (updatedItems.length === 0) {
      await deleteDailyRecord(date);
      logger.info('Schedule deleted (no items remaining)', { date });
    } else {
      const record: DailyRecord = {
        ...existingRecord,
        totalCount: updatedItems.length,
        items: updatedItems,
        savedAt: new Date().toISOString(),
      };

      await saveDailyRecord(record);
      logger.info('Item removed from date schedule', { date, itemId });
    }
  } catch (error) {
    logger.error('Failed to remove item from schedule', error as Error);
    throw error;
  }
};
