/**
 * Split TODO - TypeScript Type Definitions
 *
 * This file contains all core data model interfaces for the Split TODO application.
 * These types ensure type safety throughout the application and serve as the single
 * source of truth for data structures.
 */

/**
 * ChecklistItem represents a single step/task within a larger Task.
 * Users can check/uncheck items to track their progress.
 */
export interface ChecklistItem {
  /**
   * Unique identifier for the checklist item (UUID v4)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  id: string;

  /**
   * Title/description of the checklist item
   * Must be between 1-120 characters after normalization
   * @example "디자인 시안 작성"
   */
  title: string;

  /**
   * Completion status of the item
   * true = completed, false = not completed
   */
  done: boolean;

  /**
   * Whether this checklist item is marked as "today's task"
   * Used to filter items in the Today screen
   * Default: false
   * @deprecated Use scheduledDates instead
   */
  isToday?: boolean;

  /**
   * Array of dates (YYYY-MM-DD) this item is scheduled for
   * Replaces isToday with date-specific scheduling
   * Default: []
   */
  scheduledDates?: string[];
}

/**
 * Task represents a major to-do item that contains multiple checklist items.
 * Tasks show progress based on completed checklist items.
 */
export interface Task {
  /**
   * Unique identifier for the task (UUID v4)
   * @example "550e8400-e29b-41d4-a716-446655440000"
   */
  id: string;

  /**
   * Title/name of the task
   * Must be between 1-120 characters after normalization
   * @example "웹사이트 리뉴얼"
   */
  title: string;

  /**
   * Array of checklist items that make up this task
   * Maximum 50 items per task (AsyncStorage limitation)
   */
  items: ChecklistItem[];

  /**
   * ISO 8601 timestamp when the task was created
   * @example "2025-11-06T12:00:00.000Z"
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when the task was last updated
   * Updated whenever task title or items change
   * @example "2025-11-06T15:30:00.000Z"
   */
  updatedAt: string;

  /**
   * Schema version for future migrations
   * Optional field, defaults to 1 if not present
   * Used for backward compatibility when data structure changes
   */
  schemaVersion?: number;
}

/**
 * AppSettings represents user preferences and configuration
 */
export interface AppSettings {
  /**
   * Whether celebration animation is enabled on 100% completion
   * Default: true
   */
  celebrationEnabled: boolean;

  /**
   * Time (in 24-hour format) to auto-save daily progress
   * Default: 0 (midnight, 12:00 AM)
   * Range: 0-23
   */
  dailySaveHour: number;

  /**
   * Which day the week starts on
   * 0 = Sunday, 1 = Monday
   * Default: 0 (Sunday)
   */
  weekStartsOn: 0 | 1;
}

/**
 * AppData represents the entire application state that is persisted to storage.
 * This is the top-level structure saved to AsyncStorage.
 */
export interface AppData {
  /**
   * Schema version for the entire app data structure
   * Used for migrations when data format changes
   * Current version: 1
   */
  schemaVersion: number;

  /**
   * Array of all tasks in the application
   * Maximum 200 tasks (AsyncStorage limitation)
   */
  tasks: Task[];

  /**
   * User settings and preferences
   * Optional for backward compatibility
   */
  settings?: AppSettings;
}

/**
 * Progress represents the completion status of a task.
 * Calculated based on the number of completed checklist items.
 */
export interface Progress {
  /**
   * Number of completed checklist items
   * @example 3
   */
  done: number;

  /**
   * Total number of checklist items
   * @example 5
   */
  total: number;

  /**
   * Completion percentage (0-100)
   * Calculated as: Math.round((done / total) * 100)
   * Returns 0 if total is 0
   * @example 60
   */
  percent: number;
}

/**
 * DeletedTask represents a task that has been deleted but can still be undone.
 * Stored temporarily (3 seconds) to allow undo functionality.
 */
export interface DeletedTask {
  /**
   * The ID of the deleted task (same as Task.id)
   * Used to identify which task to restore if user undoes
   */
  id: string;

  /**
   * The complete task object that was deleted
   * Contains all task data needed for restoration
   */
  task: Task;

  /**
   * Timestamp (milliseconds since epoch) when the task was deleted
   * Used to determine when to permanently delete (after 3 seconds)
   * @example 1699275600000
   */
  deletedAt: number;
}

/**
 * ErrorCode enum defines all possible error types in the application.
 * Used for consistent error handling and user-friendly messaging.
 */
export enum ErrorCode {
  /**
   * Storage is full or near capacity
   * Triggered when AsyncStorage limit is exceeded
   */
  STORAGE_FULL = 'STORAGE_FULL',

  /**
   * User denied permission (e.g., file access for backup)
   */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /**
   * Stored data is corrupted or invalid
   * Occurs when data fails validation checks
   */
  DATA_CORRUPTED = 'DATA_CORRUPTED',

  /**
   * Task limit exceeded (200 tasks max)
   */
  TASK_LIMIT_EXCEEDED = 'TASK_LIMIT_EXCEEDED',

  /**
   * Checklist item limit exceeded (50 items per task max)
   */
  ITEM_LIMIT_EXCEEDED = 'ITEM_LIMIT_EXCEEDED',

  /**
   * Invalid input (e.g., empty title, title too long)
   */
  INVALID_INPUT = 'INVALID_INPUT',

  /**
   * Backup file is invalid or corrupted
   */
  INVALID_BACKUP = 'INVALID_BACKUP',

  /**
   * Unknown or unexpected error
   */
  UNKNOWN = 'UNKNOWN',
}

/**
 * AppError represents an application error with context for recovery.
 * Extends the standard Error class with additional fields.
 */
export interface AppError {
  /**
   * Error code for categorizing the error
   */
  code: ErrorCode;

  /**
   * Human-readable error message
   * Should be clear and actionable
   * @example "저장 공간이 부족합니다"
   */
  message: string;

  /**
   * Optional suggested action for recovery
   * Helps users understand how to fix the issue
   * @example "완료된 할 일을 삭제하거나 백업 후 초기화하세요"
   */
  recoveryAction?: string;

  /**
   * Original error object (if available)
   * Useful for debugging and logging
   */
  originalError?: Error;
}

/**
 * BackupMetadata contains information about a backup file.
 * Stored alongside backup data to help with restoration and verification.
 */
export interface BackupMetadata {
  /**
   * Schema version of the backup data
   * Must match or be compatible with current app version
   */
  version: number;

  /**
   * ISO 8601 timestamp when backup was created
   * @example "2025-11-06T12:00:00.000Z"
   */
  createdAt: string;

  /**
   * Information about the device that created the backup
   * Helps track backup source and compatibility
   */
  deviceInfo: {
    /**
     * Platform: 'ios' or 'android'
     */
    platform: 'ios' | 'android';

    /**
     * OS version
     * @example "17.1" for iOS, "14" for Android
     */
    osVersion: string;

    /**
     * App version that created the backup
     * @example "1.0.0"
     */
    appVersion: string;
  };
}

/**
 * StorageStats provides information about storage usage.
 * Used in settings screen to show user their data consumption.
 */
export interface StorageStats {
  /**
   * Number of tasks stored
   */
  taskCount: number;

  /**
   * Total number of checklist items across all tasks
   */
  itemCount: number;

  /**
   * Estimated storage size in bytes
   */
  sizeInBytes: number;

  /**
   * Human-readable storage size
   * @example "245 KB"
   */
  sizeFormatted: string;

  /**
   * Percentage of storage limit used (0-100)
   * Based on 5MB limit
   */
  percentUsed: number;
}

/**
 * ValidationResult represents the result of a validation operation.
 * Used by validation functions to return success/failure with details.
 */
export interface ValidationResult {
  /**
   * Whether validation passed
   */
  valid: boolean;

  /**
   * Error message if validation failed
   * undefined if validation passed
   */
  error?: string;

  /**
   * Additional context or suggestions
   */
  details?: string;
}

/**
 * SearchOptions configures how search operates on tasks.
 * Used in TaskListScreen when searching tasks.
 */
export interface SearchOptions {
  /**
   * Search query string
   */
  query: string;

  /**
   * Whether to search in checklist items (not just task titles)
   * Default: false
   */
  searchItems?: boolean;

  /**
   * Case-sensitive search
   * Default: false
   */
  caseSensitive?: boolean;
}

/**
 * SortOptions defines how to sort tasks in the list.
 * Used in TaskListScreen for task ordering.
 */
export interface SortOptions {
  /**
   * Field to sort by
   */
  field: 'title' | 'createdAt' | 'updatedAt' | 'progress';

  /**
   * Sort direction
   * Default: 'asc'
   */
  order?: 'asc' | 'desc';
}

/**
 * HapticFeedbackType defines available haptic feedback patterns.
 * Used for providing tactile feedback to users.
 */
export type HapticFeedbackType =
  | 'light' // Light impact (checkbox toggle)
  | 'medium' // Medium impact (button press)
  | 'heavy' // Heavy impact (delete action)
  | 'success' // Success notification (100% completion)
  | 'warning' // Warning notification (limit approaching)
  | 'error'; // Error notification (operation failed)

/**
 * ToastType defines the types of toast messages that can be shown.
 */
export type ToastType = 'success' | 'error' | 'info' | 'undo';

/**
 * ToastConfig configures a toast message to display.
 */
export interface ToastConfig {
  /**
   * Type of toast message
   */
  type: ToastType;

  /**
   * Main message text
   */
  message: string;

  /**
   * Optional duration in milliseconds
   * Default: 3000ms
   */
  duration?: number;

  /**
   * Optional callback for undo action
   * Only used with 'undo' type
   */
  onUndo?: () => void;
}

/**
 * DailyRecordItem represents a single checklist item in a daily record snapshot.
 * This is a snapshot of the item's state at the time the record was saved.
 */
export interface DailyRecordItem {
  /**
   * Original checklist item ID
   */
  id: string;

  /**
   * Original task ID
   */
  taskId: string;

  /**
   * Task title (for grouping)
   */
  taskTitle: string;

  /**
   * Item title
   */
  title: string;

  /**
   * Completion status at snapshot time
   */
  done: boolean;

  /**
   * Display order within the day
   */
  order: number;
}

/**
 * DailyRecord represents the completion record for a specific date.
 * Records are automatically saved at the configured time (default: midnight).
 *
 * For past dates: Contains snapshot of completed/incomplete items
 * For future dates: Contains planned items (scheduledItems)
 */
export interface DailyRecord {
  /**
   * Date in YYYY-MM-DD format (local timezone)
   * @example "2025-11-08"
   */
  date: string;

  /**
   * Number of completed today items
   */
  completedCount: number;

  /**
   * Total number of today items
   */
  totalCount: number;

  /**
   * Completion percentage (0-100)
   * Calculated as: Math.round((completedCount / totalCount) * 100)
   * Returns 0 if totalCount is 0
   */
  completionRate: number;

  /**
   * ISO 8601 timestamp when this record was saved
   * @example "2025-11-08T00:00:00.000Z"
   */
  savedAt: string;

  /**
   * Snapshot of checklist items for this date
   * For past dates: items that were marked as "today" on that date
   * For future dates: items scheduled for that date
   * Optional for backward compatibility with old records
   */
  items?: DailyRecordItem[];
}

/**
 * DailyRecordsData represents all daily records stored in the app.
 */
export interface DailyRecordsData {
  /**
   * Schema version for migrations
   */
  schemaVersion: number;

  /**
   * Map of date strings to daily records
   * Key: YYYY-MM-DD format
   */
  records: Record<string, DailyRecord>;
}

/**
 * SyncStatus represents the synchronization state of data with the cloud.
 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/**
 * SyncConfig contains Supabase configuration and sync state.
 */
export interface SyncConfig {
  /**
   * Current sync status
   */
  status: SyncStatus;

  /**
   * Last successful sync timestamp (ISO 8601)
   */
  lastSyncedAt?: string;

  /**
   * Error message if sync failed
   */
  error?: string;

  /**
   * Whether cloud sync is enabled
   * Default: false (local-only mode)
   */
  enabled: boolean;

  /**
   * User ID for multi-device sync (optional)
   * Only set after authentication
   */
  userId?: string;

  /**
   * User email (if authenticated with email/social)
   */
  userEmail?: string;

  /**
   * Authentication method
   */
  authMethod?: 'anonymous' | 'google' | 'apple' | 'email';
}

/**
 * Authentication provider type
 */
export type AuthProvider = 'google' | 'apple';

/**
 * User profile information
 */
export interface UserProfile {
  /**
   * User ID
   */
  id: string;

  /**
   * User email (if available)
   */
  email?: string;

  /**
   * Display name (if available)
   */
  name?: string;

  /**
   * Profile picture URL (if available)
   */
  avatarUrl?: string;

  /**
   * Authentication method
   */
  authMethod: 'anonymous' | 'google' | 'apple' | 'email';
}
