/**
 * Task Store Module (Zustand)
 *
 * Central state management for the Split TODO application.
 * Handles all task and checklist item operations with auto-save functionality.
 *
 * Features:
 * - Task CRUD operations with validation
 * - Checklist item CRUD operations
 * - Undo delete functionality (3-second window)
 * - Auto-save with 500ms debounce
 * - Immediate save on app background
 * - Haptic feedback integration
 * - Comprehensive error handling
 */

import { create } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import * as Haptics from 'expo-haptics';
import { debounce } from 'lodash';
import { Task, DeletedTask, AppData, ChecklistItem, AppSettings, SyncConfig } from '../types';
import { generateId } from '../utils/uuid';
import { validateTitle, normalizeTitle, checkTaskLimit, checkItemLimit } from '../utils/validation';
import { loadAppData, saveAppData } from '../services/storage';
import { logger } from '../utils/logger';
import {
  startDailySaveScheduler,
  updateDailySaveScheduler,
  saveTodayRecordRealtime,
} from '../services/dailySaveScheduler';
import { getTodayKey } from '../services/dailyRecords';
import {
  performFullSync,
  signInAnonymously,
  isSignedIn,
  isSupabaseConfigured,
  signInWithSocial,
  signInWithEmail,
  signOut,
  getCurrentUser,
} from '../services/cloudSync';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Task store state and actions interface
 */
interface TaskStore {
  // State
  tasks: Task[];
  deletedTasks: DeletedTask[];
  isLoading: boolean;
  error: string | null;
  settings: AppSettings;
  syncConfig: SyncConfig;

  // Initialization
  initialize: () => Promise<void>;

  // Task CRUD
  addTask: (title: string) => Promise<{ success: boolean; error?: string }>;
  updateTaskTitle: (
    taskId: string,
    newTitle: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (taskId: string) => Promise<void>;
  undoDeleteTask: (taskId: string) => void;
  getTask: (taskId: string) => Task | undefined;

  // ChecklistItem CRUD
  addChecklistItem: (
    taskId: string,
    itemTitle: string
  ) => Promise<{ success: boolean; error?: string }>;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  updateChecklistItem: (
    taskId: string,
    itemId: string,
    newTitle: string
  ) => Promise<{ success: boolean; error?: string }>;
  deleteChecklistItem: (taskId: string, itemId: string) => void;
  toggleChecklistItemToday: (taskId: string, itemId: string) => void;
  scheduleItemForDate: (taskId: string, itemId: string, date: string) => void;
  unscheduleItemFromDate: (taskId: string, itemId: string, date: string) => void;
  getItemsForDate: (date: string) => Array<{ task: Task; item: ChecklistItem }>;
  getTodayItems: () => Array<{ task: Task; item: ChecklistItem }>;

  // Settings
  toggleCelebration: () => void;
  updateDailySaveHour: (hour: number) => void;
  toggleWeekStartsOn: () => void;

  // Cloud Sync
  enableCloudSync: () => Promise<{ success: boolean; error?: string }>;
  disableCloudSync: () => void;
  syncWithCloud: () => Promise<{ success: boolean; error?: string }>;
  signInWithSocialProvider: (
    provider: 'google' | 'apple'
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithEmailPassword: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signOutUser: () => Promise<{ success: boolean; error?: string }>;
  loadUserProfile: () => Promise<void>;

  // Auto-save
  saveImmediately: () => Promise<void>;
}

// ============================================================================
// AUTO-SAVE IMPLEMENTATION
// ============================================================================

let storeInstance: TaskStore | null = null;
let appStateListener: { remove: () => void } | null = null;
let lastKnownDate: string = getTodayKey();

/**
 * Schedules a save operation with 500ms debounce.
 * Prevents excessive saves during rapid user input.
 */
const scheduleSave = debounce(
  async (tasks: Task[], settings: AppSettings) => {
    if (!storeInstance) {
      logger.warn('Store instance not available for scheduled save');
      return;
    }

    try {
      logger.debug('Scheduled save executing', { taskCount: tasks.length });

      const appData: AppData = {
        schemaVersion: 1,
        tasks,
        settings,
      };

      await saveAppData(appData);
    } catch (error) {
      logger.error('Failed to save data', error as Error);

      // Update error state in store
      if (storeInstance) {
        // Access the store state directly to update error
        useTaskStore.setState({ error: '데이터 저장에 실패했습니다' });
      }
    }
  },
  500,
  { leading: false, trailing: true }
);

/**
 * Delete timers for undo functionality
 * Maps task IDs to their deletion timeout
 */
const deleteTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Checks if the date has changed and handles the transition.
 * Called when app comes to foreground.
 */
const handleDateChange = async () => {
  const currentDate = getTodayKey();

  if (currentDate !== lastKnownDate) {
    logger.info(`Date changed: ${lastKnownDate} → ${currentDate}`);

    // Update the last known date
    // Note: We don't save the previous date's data here because:
    // 1. The tasks state may have already been migrated to the new date
    // 2. This would incorrectly save today's data as yesterday's data
    // 3. Daily records should be saved via the scheduler or real-time saves during the actual day
    lastKnownDate = currentDate;
  }
};

// ============================================================================
// ZUSTAND STORE DEFINITION
// ============================================================================

export const useTaskStore = create<TaskStore>((set, get) => {
  // Store the instance for auto-save access
  storeInstance = {
    tasks: [],
    deletedTasks: [],
    isLoading: false,
    error: null,
    settings: {
      celebrationEnabled: true,
      dailySaveHour: 0,
      weekStartsOn: 0,
    },
    syncConfig: {
      status: 'idle',
      enabled: false,
    },
    initialize: async () => {},
    addTask: async () => ({ success: false }),
    updateTaskTitle: async () => ({ success: false }),
    deleteTask: async () => {},
    undoDeleteTask: () => {},
    getTask: () => undefined,
    addChecklistItem: async () => ({ success: false }),
    toggleChecklistItem: () => {},
    updateChecklistItem: async () => ({ success: false }),
    deleteChecklistItem: () => {},
    toggleChecklistItemToday: () => {},
    scheduleItemForDate: () => {},
    unscheduleItemFromDate: () => {},
    getItemsForDate: () => [],
    getTodayItems: () => [],
    toggleCelebration: () => {},
    updateDailySaveHour: () => {},
    toggleWeekStartsOn: () => {},
    enableCloudSync: async () => ({ success: false }),
    disableCloudSync: () => {},
    syncWithCloud: async () => ({ success: false }),
    signInWithSocialProvider: async () => ({ success: false }),
    signInWithEmailPassword: async () => ({ success: false }),
    signOutUser: async () => ({ success: false }),
    loadUserProfile: async () => {},
    saveImmediately: async () => {},
  } as TaskStore;

  return {
    // ========================================================================
    // INITIAL STATE
    // ========================================================================
    tasks: [],
    deletedTasks: [],
    isLoading: true,
    error: null,
    settings: {
      celebrationEnabled: true,
      dailySaveHour: 0, // Midnight by default
      weekStartsOn: 0, // Sunday by default
    },
    syncConfig: {
      status: 'idle',
      enabled: false,
    },

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    initialize: async () => {
      const timer = logger.startTimer('Store initialization');

      try {
        logger.info('Starting app...');
        set({ isLoading: true, error: null });

        // Load data from storage
        const appData = await loadAppData();

        // Migrate isToday to scheduledDates
        const todayKey = getTodayKey();
        const migratedTasks = appData.tasks.map((task) => ({
          ...task,
          items: task.items.map((item) => {
            // If isToday is true but scheduledDates doesn't include today, migrate it
            if (item.isToday === true) {
              const scheduledDates = item.scheduledDates || [];
              if (!scheduledDates.includes(todayKey)) {
                return {
                  ...item,
                  scheduledDates: [...scheduledDates, todayKey].sort(),
                };
              }
            }
            return item;
          }),
        }));

        // Update state
        const loadedSettings = appData.settings || {
          celebrationEnabled: true,
          dailySaveHour: 0,
          weekStartsOn: 0,
        };

        set({
          tasks: migratedTasks,
          settings: loadedSettings,
          isLoading: false,
          error: null,
        });

        // Save migrated data if any migration occurred
        if (JSON.stringify(appData.tasks) !== JSON.stringify(migratedTasks)) {
          await saveAppData({ schemaVersion: 1, tasks: migratedTasks, settings: loadedSettings });
        }

        // Setup AppState listener for background save
        appStateListener = AppState.addEventListener('change', handleAppStateChange);

        // Start daily save scheduler
        startDailySaveScheduler(loadedSettings.dailySaveHour, () => get().tasks);

        // Check for date change on app start
        await handleDateChange();

        // Load user profile (check if user is already logged in)
        // Don't fail initialization if profile loading fails
        try {
          await get().loadUserProfile();
        } catch (profileError) {
          logger.warn('Failed to load user profile during initialization', profileError as Error);
          // Continue initialization even if profile loading fails
        }

        logger.info(`App ready (${appData.tasks.length} tasks)`);
        timer.end();
      } catch (error) {
        logger.error('Failed to initialize store', error as Error);
        set({
          tasks: [],
          isLoading: false,
          error: '데이터를 불러오는 데 실패했습니다',
        });
        timer.end();
      }
    },

    // ========================================================================
    // TASK CRUD OPERATIONS
    // ========================================================================

    /**
     * Adds a new task with validation.
     */
    addTask: async (title: string) => {
      try {
        logger.debug('Adding task', { title });

        // Validate title
        const titleValidation = validateTitle(title);
        if (!titleValidation.valid) {
          logger.warn('Task title validation failed', { error: titleValidation.error });
          return {
            success: false,
            error: titleValidation.error || '제목이 유효하지 않습니다',
          };
        }

        const { tasks, settings } = get();

        // Check task limit (200 tasks max)
        const limitCheck = checkTaskLimit(tasks.length);
        if (!limitCheck.valid) {
          logger.warn('Task limit exceeded', { currentCount: tasks.length });
          return {
            success: false,
            error: limitCheck.error || '최대 할 일 개수를 초과했습니다',
          };
        }

        // Create new task
        const now = new Date().toISOString();
        const newTask: Task = {
          id: generateId(),
          title: normalizeTitle(title),
          items: [],
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
        };

        // Add task to the beginning of the array
        const updatedTasks = [newTask, ...tasks];
        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        return { success: true };
      } catch (error) {
        logger.error('Failed to add task', error as Error);
        return {
          success: false,
          error: '할 일 추가에 실패했습니다',
        };
      }
    },

    /**
     * Updates a task's title with validation.
     */
    updateTaskTitle: async (taskId: string, newTitle: string) => {
      try {
        logger.debug('Updating task title', { taskId, newTitle });

        // Validate title
        const titleValidation = validateTitle(newTitle);
        if (!titleValidation.valid) {
          logger.warn('Task title validation failed', { error: titleValidation.error });
          return {
            success: false,
            error: titleValidation.error || '제목이 유효하지 않습니다',
          };
        }

        const { tasks, settings } = get();
        const normalizedTitle = normalizeTitle(newTitle);

        // Update task
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            return {
              ...task,
              title: normalizedTitle,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        return { success: true };
      } catch (error) {
        logger.error('Failed to update task title', error as Error);
        return {
          success: false,
          error: '제목 수정에 실패했습니다',
        };
      }
    },

    /**
     * Deletes a task with undo support (3-second window).
     */
    deleteTask: async (taskId: string) => {
      try {
        logger.debug('Deleting task', { taskId });

        const { tasks, settings } = get();

        // Find the task to delete
        const taskToDelete = tasks.find((task) => task.id === taskId);
        if (!taskToDelete) {
          logger.warn('Task not found for deletion', { taskId });
          return;
        }

        // Remove from tasks array
        const updatedTasks = tasks.filter((task) => task.id !== taskId);

        // Add to deletedTasks
        const deletedTask: DeletedTask = {
          id: taskId,
          task: taskToDelete,
          deletedAt: Date.now(),
        };

        set({
          tasks: updatedTasks,
          deletedTasks: [...get().deletedTasks, deletedTask],
        });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        // Set timer for permanent deletion (3 seconds)
        const deleteTimer = setTimeout(() => {
          logger.debug('Permanently deleting task', { taskId });

          const { deletedTasks } = get();
          const updatedDeletedTasks = deletedTasks.filter((dt) => dt.id !== taskId);
          set({ deletedTasks: updatedDeletedTasks });

          deleteTimers.delete(taskId);
        }, 3000);

        deleteTimers.set(taskId, deleteTimer);
      } catch (error) {
        logger.error('Failed to delete task', error as Error);
      }
    },

    /**
     * Undoes a task deletion within the 3-second window.
     */
    undoDeleteTask: (taskId: string) => {
      try {
        logger.debug('Undoing task deletion', { taskId });

        const { deletedTasks, tasks, settings } = get();

        // Find the deleted task
        const deletedTask = deletedTasks.find((dt) => dt.id === taskId);
        if (!deletedTask) {
          logger.warn('Deleted task not found for undo', { taskId });
          return;
        }

        // Cancel the permanent deletion timer
        const timer = deleteTimers.get(taskId);
        if (timer) {
          clearTimeout(timer);
          deleteTimers.delete(taskId);
        }

        // Restore task to the beginning of the array
        const updatedTasks = [deletedTask.task, ...tasks];

        // Remove from deletedTasks
        const updatedDeletedTasks = deletedTasks.filter((dt) => dt.id !== taskId);

        set({
          tasks: updatedTasks,
          deletedTasks: updatedDeletedTasks,
        });

        // Schedule save
        scheduleSave(updatedTasks, settings);
      } catch (error) {
        logger.error('Failed to undo task deletion', error as Error);
      }
    },

    /**
     * Retrieves a task by ID.
     */
    getTask: (taskId: string) => {
      const { tasks } = get();
      return tasks.find((task) => task.id === taskId);
    },

    // ========================================================================
    // CHECKLIST ITEM CRUD OPERATIONS
    // ========================================================================

    /**
     * Adds a checklist item to a task with validation.
     */
    addChecklistItem: async (taskId: string, itemTitle: string) => {
      try {
        logger.debug('Adding checklist item', { taskId, itemTitle });

        // Validate title
        const titleValidation = validateTitle(itemTitle);
        if (!titleValidation.valid) {
          logger.warn('Item title validation failed', { error: titleValidation.error });
          return {
            success: false,
            error: titleValidation.error || '제목이 유효하지 않습니다',
          };
        }

        const { tasks, settings } = get();

        // Find the task
        const task = tasks.find((t) => t.id === taskId);
        if (!task) {
          logger.warn('Task not found for adding item', { taskId });
          return {
            success: false,
            error: '할 일을 찾을 수 없습니다',
          };
        }

        // Check item limit (50 items max per task)
        const limitCheck = checkItemLimit(task.items.length);
        if (!limitCheck.valid) {
          logger.warn('Item limit exceeded', { taskId, currentCount: task.items.length });
          return {
            success: false,
            error: limitCheck.error || '최대 항목 개수를 초과했습니다',
          };
        }

        // Create new checklist item
        const newItem = {
          id: generateId(),
          title: normalizeTitle(itemTitle),
          done: false,
        };

        // Update task with new item
        const updatedTasks = tasks.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              items: [...t.items, newItem],
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        return { success: true };
      } catch (error) {
        logger.error('Failed to add checklist item', error as Error);
        return {
          success: false,
          error: '항목 추가에 실패했습니다',
        };
      }
    },

    /**
     * Toggles a checklist item's done status with haptic feedback.
     */
    toggleChecklistItem: (taskId: string, itemId: string) => {
      try {
        logger.debug('Toggling checklist item', { taskId, itemId });

        const { tasks, settings } = get();

        // Update item's done status
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            const updatedItems = task.items.map((item) => {
              if (item.id === itemId) {
                return { ...item, done: !item.done };
              }
              return item;
            });

            return {
              ...task,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
          logger.debug('Haptic feedback failed', { error });
        });

        logger.debug('Checklist item toggled', { taskId, itemId });
      } catch (error) {
        logger.error('Failed to toggle checklist item', error as Error);
      }
    },

    /**
     * Updates a checklist item's title with validation.
     */
    updateChecklistItem: async (taskId: string, itemId: string, newTitle: string) => {
      try {
        logger.debug('Updating checklist item', { taskId, itemId, newTitle });

        // Validate title
        const titleValidation = validateTitle(newTitle);
        if (!titleValidation.valid) {
          logger.warn('Item title validation failed', { error: titleValidation.error });
          return {
            success: false,
            error: titleValidation.error || '제목이 유효하지 않습니다',
          };
        }

        const { tasks, settings } = get();
        const normalizedTitle = normalizeTitle(newTitle);

        // Update item
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            const updatedItems = task.items.map((item) => {
              if (item.id === itemId) {
                return { ...item, title: normalizedTitle };
              }
              return item;
            });

            return {
              ...task,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        return { success: true };
      } catch (error) {
        logger.error('Failed to update checklist item', error as Error);
        return {
          success: false,
          error: '항목 수정에 실패했습니다',
        };
      }
    },

    /**
     * Deletes a checklist item from a task.
     */
    deleteChecklistItem: (taskId: string, itemId: string) => {
      try {
        logger.debug('Deleting checklist item', { taskId, itemId });

        const { tasks, settings } = get();

        // Remove item from task
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            const updatedItems = task.items.filter((item) => item.id !== itemId);

            return {
              ...task,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);
      } catch (error) {
        logger.error('Failed to delete checklist item', error as Error);
      }
    },

    /**
     * Toggles a checklist item's isToday status.
     * @deprecated Use scheduleItemForDate/unscheduleItemFromDate instead
     */
    toggleChecklistItemToday: (taskId: string, itemId: string) => {
      try {
        logger.debug('Toggling checklist item today status (legacy)', { taskId, itemId });

        const todayKey = getTodayKey();
        const { tasks, settings } = get();

        // Find the item
        const task = tasks.find((t) => t.id === taskId);
        const item = task?.items.find((i) => i.id === itemId);

        if (!item) {
          logger.warn('Item not found', { taskId, itemId });
          return;
        }

        // Check if item is scheduled for today
        const scheduledDates = item.scheduledDates || [];
        const isScheduledToday = scheduledDates.includes(todayKey);

        // Update item's scheduledDates
        const updatedTasks = tasks.map((t) => {
          if (t.id === taskId) {
            const updatedItems = t.items.map((i) => {
              if (i.id === itemId) {
                const currentDates = i.scheduledDates || [];
                const newDates = isScheduledToday
                  ? currentDates.filter((d) => d !== todayKey)
                  : [...currentDates, todayKey].sort();

                return {
                  ...i,
                  scheduledDates: newDates,
                };
              }
              return i;
            });

            return {
              ...t,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
          logger.debug('Haptic feedback failed', { error });
        });

        logger.debug('Checklist item today status toggled', { taskId, itemId, isScheduledToday });
      } catch (error) {
        logger.error('Failed to toggle checklist item today status', error as Error);
      }
    },

    /**
     * Schedules an item for a specific date.
     */
    scheduleItemForDate: (taskId: string, itemId: string, date: string) => {
      try {
        logger.debug('Scheduling item for date', { taskId, itemId, date });

        const { tasks, settings } = get();

        // Update item's scheduledDates
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            const updatedItems = task.items.map((item) => {
              if (item.id === itemId) {
                const scheduledDates = item.scheduledDates || [];

                // Add date if not already scheduled
                if (!scheduledDates.includes(date)) {
                  return {
                    ...item,
                    scheduledDates: [...scheduledDates, date].sort(),
                  };
                }
              }
              return item;
            });

            return {
              ...task,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
          logger.debug('Haptic feedback failed', { error });
        });
      } catch (error) {
        logger.error('Failed to schedule item for date', error as Error);
      }
    },

    /**
     * Unschedules an item from a specific date.
     */
    unscheduleItemFromDate: (taskId: string, itemId: string, date: string) => {
      try {
        logger.debug('Unscheduling item from date', { taskId, itemId, date });

        const { tasks, settings } = get();

        // Update item's scheduledDates
        const updatedTasks = tasks.map((task) => {
          if (task.id === taskId) {
            const updatedItems = task.items.map((item) => {
              if (item.id === itemId) {
                const scheduledDates = item.scheduledDates || [];

                // Remove date
                return {
                  ...item,
                  scheduledDates: scheduledDates.filter((d) => d !== date),
                };
              }
              return item;
            });

            return {
              ...task,
              items: updatedItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        });

        set({ tasks: updatedTasks });

        // Schedule save
        scheduleSave(updatedTasks, settings);

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((error) => {
          logger.debug('Haptic feedback failed', { error });
        });
      } catch (error) {
        logger.error('Failed to unschedule item from date', error as Error);
      }
    },

    /**
     * Gets all checklist items scheduled for a specific date.
     */
    getItemsForDate: (date: string) => {
      const { tasks } = get();
      const items: Array<{ task: Task; item: ChecklistItem }> = [];

      tasks.forEach((task) => {
        task.items.forEach((item) => {
          const scheduledDates = item.scheduledDates || [];
          if (scheduledDates.includes(date)) {
            items.push({ task, item });
          }
        });
      });

      logger.debug('Retrieved items for date', { date, count: items.length });
      return items;
    },

    /**
     * Retrieves all checklist items marked as today's tasks.
     * Returns an array of objects containing both the task and the item.
     * Supports both legacy isToday and new scheduledDates.
     */
    getTodayItems: () => {
      const todayKey = getTodayKey();
      return get().getItemsForDate(todayKey);
    },

    // ========================================================================
    // SETTINGS
    // ========================================================================

    /**
     * Toggles celebration animation setting.
     */
    toggleCelebration: () => {
      const { settings, tasks } = get();
      const newSettings = {
        ...settings,
        celebrationEnabled: !settings.celebrationEnabled,
      };

      set({ settings: newSettings });
      scheduleSave(tasks, newSettings);
    },

    /**
     * Updates the daily save hour setting.
     * @param hour - Hour (0-23) to auto-save at
     */
    updateDailySaveHour: (hour: number) => {
      if (hour < 0 || hour > 23) {
        const error = new Error(`Invalid dailySaveHour: ${hour}`);
        logger.error('Invalid dailySaveHour', error);
        return;
      }

      const { settings, tasks } = get();
      const newSettings = {
        ...settings,
        dailySaveHour: hour,
      };

      set({ settings: newSettings });
      scheduleSave(tasks, newSettings);

      // Update the scheduler
      updateDailySaveScheduler(hour, () => get().tasks);
    },

    /**
     * Toggles the week starts on setting (Sunday <-> Monday).
     */
    toggleWeekStartsOn: () => {
      const { settings, tasks } = get();
      const newWeekStartsOn: 0 | 1 = settings.weekStartsOn === 0 ? 1 : 0;
      const newSettings = {
        ...settings,
        weekStartsOn: newWeekStartsOn,
      };

      set({ settings: newSettings });
      scheduleSave(tasks, newSettings);
    },

    // ========================================================================
    // CLOUD SYNC
    // ========================================================================

    /**
     * Enables cloud sync and signs in anonymously
     */
    enableCloudSync: async () => {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          error: 'Supabase가 설정되지 않았습니다. 환경 변수를 확인해주세요.',
        };
      }

      try {
        logger.info('Enabling cloud sync');
        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'syncing',
            error: undefined,
          },
        });

        // Check if already signed in
        const signedIn = await isSignedIn();

        if (!signedIn) {
          // Sign in anonymously
          const signInResult = await signInAnonymously();

          if (!signInResult.success) {
            set({
              syncConfig: {
                ...get().syncConfig,
                status: 'error',
                error: signInResult.error,
              },
            });
            return {
              success: false,
              error: signInResult.error,
            };
          }

          set({
            syncConfig: {
              ...get().syncConfig,
              userId: signInResult.userId,
            },
          });
        }

        // Perform initial sync
        const syncResult = await get().syncWithCloud();

        if (!syncResult.success) {
          return syncResult;
        }

        // Enable sync
        set({
          syncConfig: {
            ...get().syncConfig,
            enabled: true,
            status: 'success',
            lastSyncedAt: new Date().toISOString(),
          },
        });

        logger.info('Cloud sync enabled successfully');
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Failed to enable cloud sync', error as Error);

        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'error',
            error: errorMessage,
          },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Disables cloud sync
     */
    disableCloudSync: () => {
      logger.info('Disabling cloud sync');

      set({
        syncConfig: {
          status: 'idle',
          enabled: false,
          lastSyncedAt: get().syncConfig.lastSyncedAt,
        },
      });
    },

    /**
     * Syncs data with cloud storage
     */
    syncWithCloud: async () => {
      // Check if user is signed in (instead of checking enabled flag)
      const signedIn = await isSignedIn();
      if (!signedIn) {
        return {
          success: false,
          error: 'No active session',
        };
      }

      try {
        logger.info('Syncing with cloud');
        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'syncing',
            error: undefined,
          },
        });

        const { tasks } = get();
        const syncResult = await performFullSync(tasks);

        if (!syncResult.result.success) {
          set({
            syncConfig: {
              ...get().syncConfig,
              status: 'error',
              error: syncResult.result.error,
            },
          });

          return {
            success: false,
            error: syncResult.result.error,
          };
        }

        // Update tasks if they changed during merge
        if (
          syncResult.tasks.length !== tasks.length ||
          JSON.stringify(syncResult.tasks) !== JSON.stringify(tasks)
        ) {
          set({ tasks: syncResult.tasks });
          scheduleSave(syncResult.tasks, get().settings);
        }

        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'success',
            lastSyncedAt: new Date().toISOString(),
            error: undefined,
          },
        });

        logger.info('Cloud sync completed successfully');
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Cloud sync failed', error as Error);

        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'error',
            error: errorMessage,
          },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Sign in with social provider (Google or Apple)
     */
    signInWithSocialProvider: async (provider: 'google' | 'apple') => {
      try {
        logger.info('Signing in with social provider', { provider });

        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'syncing',
            error: undefined,
          },
        });

        const result = await signInWithSocial(provider);

        if (!result.success) {
          set({
            syncConfig: {
              ...get().syncConfig,
              status: 'error',
              error: result.error,
            },
          });
          return result;
        }

        // Note: OAuth flow is initiated and will complete via handleOAuthCallback
        // For now, mark as enabled and let the callback update user info
        set({
          syncConfig: {
            ...get().syncConfig,
            enabled: true,
            status: 'success',
          },
        });

        logger.info('Social sign in initiated', { provider });
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Social sign in failed', error as Error);

        set({
          syncConfig: {
            ...get().syncConfig,
            status: 'error',
            error: errorMessage,
          },
        });

        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Sign in with email and password
     */
    signInWithEmailPassword: async (email: string, password: string) => {
      try {
        logger.info('Signing in with email');

        const result = await signInWithEmail(email, password);

        if (!result.success) {
          return result;
        }

        // Update sync config with user profile
        set({
          syncConfig: {
            ...get().syncConfig,
            userId: result.user?.id,
            userEmail: result.user?.email,
            authMethod: 'email',
            enabled: true,
          },
        });

        // Perform initial sync
        await get().syncWithCloud();

        logger.info('Email sign in completed');
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Email sign in failed', error as Error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Sign out current user
     */
    signOutUser: async () => {
      try {
        logger.info('Signing out user');

        const result = await signOut();

        if (!result.success) {
          return result;
        }

        // Reset sync config
        set({
          syncConfig: {
            status: 'idle',
            enabled: false,
          },
        });

        logger.info('Sign out completed');
        return { success: true };
      } catch (error) {
        const errorMessage = (error as Error).message;
        logger.error('Sign out failed', error as Error);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },

    /**
     * Load current user profile
     */
    loadUserProfile: async () => {
      try {
        const user = await getCurrentUser();

        if (user) {
          logger.info('User profile loaded', { email: user.email, authMethod: user.authMethod });
          set({
            syncConfig: {
              ...get().syncConfig,
              enabled: true,
              userId: user.id,
              userEmail: user.email,
              authMethod: user.authMethod,
            },
          });
        } else {
          logger.info('No user session found');
        }
      } catch (error) {
        logger.error('Failed to load user profile', error as Error);
      }
    },

    // ========================================================================
    // AUTO-SAVE
    // ========================================================================

    /**
     * Saves data immediately (bypasses debounce).
     * Used when app goes to background.
     */
    saveImmediately: async () => {
      try {
        logger.debug('Saving immediately');

        // Cancel any pending debounced save
        scheduleSave.cancel();

        const { tasks, settings } = get();

        const appData: AppData = {
          schemaVersion: 1,
          tasks,
          settings,
        };

        await saveAppData(appData);
      } catch (error) {
        logger.error('Failed to save immediately', error as Error);
        set({ error: '데이터 저장에 실패했습니다' });
      }
    },
  };
});

// ============================================================================
// APP STATE HANDLER
// ============================================================================

/**
 * Handles app state changes (foreground/background transitions).
 * Saves data immediately when app goes to background or becomes inactive.
 * Checks for date changes when app comes to foreground.
 */
function handleAppStateChange(nextAppState: AppStateStatus) {
  logger.debug('App state changed', { nextAppState });

  if (nextAppState === 'background' || nextAppState === 'inactive') {
    logger.info('App going to background, saving immediately');

    const store = useTaskStore.getState();
    store.saveImmediately().catch((error) => {
      logger.error('Failed to save on background', error);
    });

    // Also save today's record
    const tasks = useTaskStore.getState().tasks;
    saveTodayRecordRealtime(tasks).catch((error) => {
      logger.error('Failed to save today record on background', error);
    });
  } else if (nextAppState === 'active') {
    logger.info('App coming to foreground, checking for date change');

    // Check if date has changed
    handleDateChange().catch((error) => {
      logger.error('Failed to handle date change', error);
    });
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Cleanup function to be called when app unmounts.
 * Removes event listeners and cancels pending operations.
 */
export function cleanupTaskStore() {
  logger.debug('Cleaning up task store');

  // Remove AppState listener
  if (appStateListener) {
    appStateListener.remove();
    appStateListener = null;
  }

  // Cancel pending saves
  scheduleSave.cancel();

  // Clear all delete timers
  deleteTimers.forEach((timer) => clearTimeout(timer));
  deleteTimers.clear();

  logger.info('Task store cleanup completed');
}
