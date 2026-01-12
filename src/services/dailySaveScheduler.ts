/**
 * Daily Save Scheduler
 *
 * Schedules automatic daily record saves at the configured time.
 * Uses a combination of timers and app state listeners.
 *
 * Extended to save daily snapshots with item details.
 */

import { AppState, AppStateStatus } from 'react-native';
import { Task } from '../types';
import { getTodayKey, saveDailySnapshot } from './dailyRecords';
import { logger } from '../utils/logger';

let dailySaveTimer: NodeJS.Timeout | null = null;
let appStateListener: { remove: () => void } | null = null;
let lastSaveDate: string | null = null;
let savingInProgress = false;
let saveQueue: { tasks: Task[]; dateKey?: string } | null = null;

/**
 * Creates and saves a daily record for today with full item snapshot.
 */
export const saveTodayRecord = async (tasks: Task[]): Promise<void> => {
  try {
    const todayKey = getTodayKey();

    // Prevent duplicate saves on the same day
    if (lastSaveDate === todayKey) {
      return;
    }

    // Save snapshot with full item details
    await saveDailySnapshot(todayKey, tasks);

    lastSaveDate = todayKey;
    logger.info(`Daily saved: ${todayKey}`);
  } catch (error) {
    logger.error('Failed to save today record', error as Error);
  }
};

/**
 * Calculates milliseconds until the next scheduled save time.
 * @param saveHour - Hour (0-23) to save at
 */
const getMillisecondsUntilSave = (saveHour: number): number => {
  const now = new Date();
  const targetTime = new Date();

  targetTime.setHours(saveHour, 0, 0, 0);

  // If target time has already passed today, schedule for tomorrow
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }

  const msUntilSave = targetTime.getTime() - now.getTime();
  return msUntilSave;
};

/**
 * Schedules the next daily save.
 */
const scheduleNextSave = (saveHour: number, getTasks: () => Task[]): void => {
  // Clear existing timer
  if (dailySaveTimer) {
    clearTimeout(dailySaveTimer);
    dailySaveTimer = null;
  }

  const msUntilSave = getMillisecondsUntilSave(saveHour);

  // Schedule the save
  dailySaveTimer = setTimeout(async () => {
    const tasks = getTasks();
    await saveTodayRecord(tasks);

    // Schedule the next save (24 hours later)
    scheduleNextSave(saveHour, getTasks);
  }, msUntilSave);
};

/**
 * Starts the daily save scheduler.
 * @param saveHour - Hour (0-23) to auto-save at
 * @param getTasks - Function to get current tasks
 */
export const startDailySaveScheduler = (saveHour: number, getTasks: () => Task[]): void => {
  try {
    // Validate saveHour
    if (saveHour < 0 || saveHour > 23) {
      const error = new Error(`Invalid saveHour: ${saveHour}`);
      logger.error('Invalid saveHour', error);
      return;
    }

    // Schedule the first save
    scheduleNextSave(saveHour, getTasks);

    // Listen for app state changes
    // Save when app goes to background (in case user doesn't open app at scheduled time)
    appStateListener = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        const todayKey = getTodayKey();

        // Only save if we haven't saved today yet
        if (lastSaveDate !== todayKey) {
          const tasks = getTasks();
          saveTodayRecord(tasks).catch((error) => {
            logger.error('Failed to save on background', error);
          });
        }
      }
    });
  } catch (error) {
    logger.error('Failed to start daily save scheduler', error as Error);
  }
};

/**
 * Stops the daily save scheduler.
 */
export const stopDailySaveScheduler = (): void => {
  try {
    // Clear timer
    if (dailySaveTimer) {
      clearTimeout(dailySaveTimer);
      dailySaveTimer = null;
    }

    // Remove app state listener
    if (appStateListener) {
      appStateListener.remove();
      appStateListener = null;
    }
  } catch (error) {
    logger.error('Failed to stop daily save scheduler', error as Error);
  }
};

/**
 * Restarts the daily save scheduler with a new save hour.
 */
export const updateDailySaveScheduler = (saveHour: number, getTasks: () => Task[]): void => {
  stopDailySaveScheduler();
  startDailySaveScheduler(saveHour, getTasks);
};

/**
 * Manually triggers a daily save (useful for testing or manual user action).
 */
export const manualSaveToday = async (tasks: Task[]): Promise<void> => {
  await saveTodayRecord(tasks);
};

/**
 * Saves today's record immediately with queue-based concurrency control.
 * Used when user completes/uncompletes today's items.
 * Saves full snapshot with item details.
 * @param tasks - Current tasks array
 * @param dateKey - Optional date key (defaults to today). Use this when saving historical data.
 */
export const saveTodayRecordRealtime = async (tasks: Task[], dateKey?: string): Promise<void> => {
  // If already saving, queue this request
  if (savingInProgress) {
    saveQueue = { tasks, dateKey };
    return;
  }

  savingInProgress = true;

  try {
    const targetDate = dateKey || getTodayKey();

    // Save snapshot with full item details
    await saveDailySnapshot(targetDate, tasks);

    // Update lastSaveDate so the scheduler doesn't duplicate save
    lastSaveDate = targetDate;
  } catch (error) {
    logger.error('Failed to save realtime record', error as Error);
  } finally {
    savingInProgress = false;

    // Process queued save if exists
    if (saveQueue) {
      const queued = saveQueue;
      saveQueue = null;
      // Don't await to avoid blocking
      saveTodayRecordRealtime(queued.tasks, queued.dateKey).catch((error) => {
        logger.error('Failed to process queued save', error as Error);
      });
    }
  }
};
