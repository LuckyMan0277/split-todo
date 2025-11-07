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
import { Task, DeletedTask, AppData } from '../types';
import { generateId } from '../utils/uuid';
import { validateTitle, normalizeTitle, checkTaskLimit, checkItemLimit } from '../utils/validation';
import { loadAppData, saveAppData } from '../services/storage';
import { logger } from '../utils/logger';

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

  // Initialization
  initialize: () => Promise<void>;

  // Task CRUD
  addTask: (title: string) => Promise<{ success: boolean; error?: string }>;
  updateTaskTitle: (taskId: string, newTitle: string) => Promise<{ success: boolean; error?: string }>;
  deleteTask: (taskId: string) => Promise<void>;
  undoDeleteTask: (taskId: string) => void;
  getTask: (taskId: string) => Task | undefined;

  // ChecklistItem CRUD
  addChecklistItem: (taskId: string, itemTitle: string) => Promise<{ success: boolean; error?: string }>;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  updateChecklistItem: (taskId: string, itemId: string, newTitle: string) => Promise<{ success: boolean; error?: string }>;
  deleteChecklistItem: (taskId: string, itemId: string) => void;

  // Auto-save
  saveImmediately: () => Promise<void>;
}

// ============================================================================
// AUTO-SAVE IMPLEMENTATION
// ============================================================================

let storeInstance: TaskStore | null = null;
let appStateListener: any = null;

/**
 * Schedules a save operation with 500ms debounce.
 * Prevents excessive saves during rapid user input.
 */
const scheduleSave = debounce(
  async (tasks: Task[]) => {
    if (!storeInstance) {
      logger.warn('Store instance not available for scheduled save');
      return;
    }

    try {
      logger.debug('Scheduled save executing', { taskCount: tasks.length });

      const appData: AppData = {
        schemaVersion: 1,
        tasks,
      };

      await saveAppData(appData);
      logger.info('Scheduled save completed successfully');
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

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    initialize: async () => {
      const timer = logger.startTimer('Store initialization');

      try {
        logger.info('Initializing task store...');
        set({ isLoading: true, error: null });

        // Load data from storage
        const appData = await loadAppData();
        logger.info('App data loaded', { taskCount: appData.tasks.length });

        // Update state
        set({
          tasks: appData.tasks,
          isLoading: false,
          error: null,
        });

        // Setup AppState listener for background save
        appStateListener = AppState.addEventListener('change', handleAppStateChange);

        logger.info('Store initialization completed successfully');
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

        const { tasks } = get();

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
        scheduleSave(updatedTasks);

        logger.info('Task added successfully', { taskId: newTask.id, title: newTask.title });
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

        const { tasks } = get();
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
        scheduleSave(updatedTasks);

        logger.info('Task title updated', { taskId, newTitle: normalizedTitle });
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

        const { tasks } = get();

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
        scheduleSave(updatedTasks);

        // Set timer for permanent deletion (3 seconds)
        const deleteTimer = setTimeout(() => {
          logger.debug('Permanently deleting task', { taskId });

          const { deletedTasks } = get();
          const updatedDeletedTasks = deletedTasks.filter((dt) => dt.id !== taskId);
          set({ deletedTasks: updatedDeletedTasks });

          deleteTimers.delete(taskId);
        }, 3000);

        deleteTimers.set(taskId, deleteTimer);

        logger.info('Task deleted (undo available for 3 seconds)', {
          taskId,
          title: taskToDelete.title,
        });
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

        const { deletedTasks, tasks } = get();

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
        scheduleSave(updatedTasks);

        logger.info('Task deletion undone', { taskId, title: deletedTask.task.title });
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

        const { tasks } = get();

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
        scheduleSave(updatedTasks);

        logger.info('Checklist item added', { taskId, itemId: newItem.id, title: newItem.title });
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

        const { tasks } = get();

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
        scheduleSave(updatedTasks);

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

        const { tasks } = get();
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
        scheduleSave(updatedTasks);

        logger.info('Checklist item updated', { taskId, itemId, newTitle: normalizedTitle });
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

        const { tasks } = get();

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
        scheduleSave(updatedTasks);

        logger.info('Checklist item deleted', { taskId, itemId });
      } catch (error) {
        logger.error('Failed to delete checklist item', error as Error);
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

        const { tasks } = get();

        const appData: AppData = {
          schemaVersion: 1,
          tasks,
        };

        await saveAppData(appData);
        logger.info('Immediate save completed successfully');
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
 */
function handleAppStateChange(nextAppState: AppStateStatus) {
  logger.debug('App state changed', { nextAppState });

  if (nextAppState === 'background' || nextAppState === 'inactive') {
    logger.info('App going to background, saving immediately');

    const store = useTaskStore.getState();
    store.saveImmediately().catch((error) => {
      logger.error('Failed to save on background', error);
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
