/**
 * Cloud Sync Service
 *
 * Provides cloud synchronization with Supabase.
 *
 * Strategy:
 * - Local-first: All operations work offline
 * - Background sync: Automatic sync when online
 * - Conflict resolution: Last-write-wins based on updatedAt timestamp
 * - Anonymous mode: Works without authentication (device-specific sync)
 *
 * Features:
 * - Sync tasks to/from cloud
 * - Sync daily records to/from cloud
 * - Automatic conflict resolution
 * - Error handling and retry logic
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { Task, DailyRecord, AuthProvider, UserProfile } from '../types';
import { logger } from '../utils/logger';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';

/**
 * Sync result type
 */
export interface SyncResult {
  success: boolean;
  error?: string;
  tasksSynced?: number;
  recordsSynced?: number;
}

/**
 * Syncs tasks to cloud storage
 *
 * @param tasks - Local tasks to sync
 * @returns Sync result
 */
export async function syncTasksToCloud(tasks: Task[]): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured, skipping cloud sync');
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  const timer = logger.startTimer('Sync tasks to cloud');

  try {
    logger.debug('Syncing tasks to cloud', { taskCount: tasks.length });

    // Get current user (anonymous or authenticated)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      logger.warn('No active session, cannot sync to cloud');
      timer.end();
      return {
        success: false,
        error: 'No active session',
      };
    }

    const userId = session.user.id;

    // Upsert tasks (insert or update)
    const tasksToSync = tasks.map((task) => ({
      id: task.id,
      user_id: userId,
      title: task.title,
      items: task.items,
      created_at: task.createdAt,
      updated_at: task.updatedAt,
      schema_version: task.schemaVersion || 1,
    }));

    const { error } = await supabase.from('tasks').upsert(tasksToSync, {
      onConflict: 'id',
    });

    if (error) {
      logger.error('Failed to sync tasks to cloud', error);
      timer.end();
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info('Tasks synced to cloud successfully', {
      tasksSynced: tasks.length,
    });

    timer.end();
    return {
      success: true,
      tasksSynced: tasks.length,
    };
  } catch (error) {
    logger.error('Unexpected error syncing tasks to cloud', error as Error);
    timer.end();
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Syncs tasks from cloud storage
 *
 * @returns Synced tasks or empty array
 */
export async function syncTasksFromCloud(): Promise<Task[]> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured, skipping cloud sync');
    return [];
  }

  const timer = logger.startTimer('Sync tasks from cloud');

  try {
    logger.debug('Syncing tasks from cloud');

    // Get current user
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      logger.warn('No active session, cannot sync from cloud');
      timer.end();
      return [];
    }

    // Fetch tasks for current user
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Failed to sync tasks from cloud', error);
      timer.end();
      return [];
    }

    // Convert database rows to Task objects
    const tasks: Task[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      items: row.items,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      schemaVersion: row.schema_version,
    }));

    logger.info('Tasks synced from cloud successfully', {
      taskCount: tasks.length,
    });

    timer.end();
    return tasks;
  } catch (error) {
    logger.error('Unexpected error syncing tasks from cloud', error as Error);
    timer.end();
    return [];
  }
}

/**
 * Merges local and cloud tasks using last-write-wins strategy
 *
 * @param localTasks - Tasks from local storage
 * @param cloudTasks - Tasks from cloud storage
 * @returns Merged tasks
 */
export function mergeTasks(localTasks: Task[], cloudTasks: Task[]): Task[] {
  const merged = new Map<string, Task>();

  // Add all local tasks
  localTasks.forEach((task) => {
    merged.set(task.id, task);
  });

  // Merge cloud tasks (keep newer version)
  cloudTasks.forEach((cloudTask) => {
    const localTask = merged.get(cloudTask.id);

    if (!localTask) {
      // New task from cloud
      merged.set(cloudTask.id, cloudTask);
    } else {
      // Conflict: keep newer version based on updatedAt
      const localUpdatedAt = new Date(localTask.updatedAt).getTime();
      const cloudUpdatedAt = new Date(cloudTask.updatedAt).getTime();

      if (cloudUpdatedAt > localUpdatedAt) {
        merged.set(cloudTask.id, cloudTask);
        logger.debug('Cloud task is newer, using cloud version', {
          taskId: cloudTask.id,
        });
      } else {
        logger.debug('Local task is newer, keeping local version', {
          taskId: localTask.id,
        });
      }
    }
  });

  return Array.from(merged.values());
}

/**
 * Performs a full sync: pull from cloud, merge, push to cloud
 *
 * @param localTasks - Current local tasks
 * @returns Merged tasks and sync result
 */
export async function performFullSync(localTasks: Task[]): Promise<{
  tasks: Task[];
  result: SyncResult;
}> {
  const timer = logger.startTimer('Perform full sync');

  try {
    // Step 1: Pull from cloud
    const cloudTasks = await syncTasksFromCloud();

    // Step 2: Merge
    const mergedTasks = mergeTasks(localTasks, cloudTasks);

    // Step 3: Push to cloud
    const result = await syncTasksToCloud(mergedTasks);

    logger.info('Full sync completed', {
      localCount: localTasks.length,
      cloudCount: cloudTasks.length,
      mergedCount: mergedTasks.length,
    });

    timer.end();
    return {
      tasks: mergedTasks,
      result,
    };
  } catch (error) {
    logger.error('Full sync failed', error as Error);
    timer.end();
    return {
      tasks: localTasks,
      result: {
        success: false,
        error: (error as Error).message,
      },
    };
  }
}

/**
 * Syncs a single daily record to cloud
 *
 * @param record - Daily record to sync
 * @returns Sync result
 */
export async function syncDailyRecordToCloud(record: DailyRecord): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return {
        success: false,
        error: 'No active session',
      };
    }

    const { error } = await supabase.from('daily_records').upsert(
      {
        user_id: session.user.id,
        date: record.date,
        completed_count: record.completedCount,
        total_count: record.totalCount,
        completion_rate: record.completionRate,
        saved_at: record.savedAt,
        items: record.items || [],
      },
      {
        onConflict: 'user_id,date',
      }
    );

    if (error) {
      logger.error('Failed to sync daily record to cloud', error);
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      recordsSynced: 1,
    };
  } catch (error) {
    logger.error('Unexpected error syncing daily record', error as Error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sign in anonymously to enable cloud sync without account
 *
 * @returns Success status and user ID
 */
export async function signInAnonymously(): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      logger.error('Anonymous sign in failed', error);
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info('Signed in anonymously', { userId: data.user?.id });

    return {
      success: true,
      userId: data.user?.id,
    };
  } catch (error) {
    logger.error('Unexpected error during anonymous sign in', error as Error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Check if user is currently signed in
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  } catch {
    return false;
  }
}

/**
 * Sign in with social provider (Google or Apple)
 *
 * @param provider - 'google' or 'apple'
 * @returns Success status, user profile, and error
 */
export async function signInWithSocial(provider: AuthProvider): Promise<{
  success: boolean;
  user?: UserProfile;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  try {
    // Configure web browser for OAuth
    WebBrowser.maybeCompleteAuthSession();

    const redirectUrl = makeRedirectUri({
      scheme: 'split-todo',
    });

    logger.debug('Signing in with social provider', { provider, redirectUrl });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      logger.error('Social sign in failed', error);
      return {
        success: false,
        error: error.message,
      };
    }

    // OAuth will redirect to browser
    // Session will be available after user completes OAuth flow
    // Don't check for session immediately - it will be set by deep link handler
    logger.info('OAuth flow initiated, waiting for callback', { provider });

    return {
      success: true,
    };
  } catch (error) {
    logger.error('Unexpected error during social sign in', error as Error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sign in with email and password
 *
 * @param email - User email
 * @param password - User password
 * @returns Success status, user profile, and error
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: UserProfile;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase not configured',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.error('Email sign in failed', error);
      return {
        success: false,
        error: error.message,
      };
    }

    const userProfile: UserProfile = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.user_metadata?.name,
      authMethod: 'email',
    };

    logger.info('Signed in with email successfully', { email });

    return {
      success: true,
      user: userProfile,
    };
  } catch (error) {
    logger.error('Unexpected error during email sign in', error as Error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('Sign out failed', error);
      return {
        success: false,
        error: error.message,
      };
    }

    logger.info('Signed out successfully');

    return {
      success: true,
    };
  } catch (error) {
    logger.error('Unexpected error during sign out', error as Error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<UserProfile | null> {
  // If Supabase is not configured, skip session check
  if (!isSupabaseConfigured()) {
    logger.debug('Supabase not configured, skipping session check');
    return null;
  }

  try {
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<{ data: { session: null } }>((_, reject) => {
      setTimeout(() => reject(new Error('Session check timeout')), 5000);
    });

    const sessionPromise = supabase.auth.getSession();

    const {
      data: { session },
    } = await Promise.race([sessionPromise, timeoutPromise]);

    if (!session) {
      logger.debug('No session found');
      return null;
    }

    // Determine auth method
    let authMethod: 'anonymous' | 'google' | 'apple' | 'email' = 'anonymous';
    if (session.user.app_metadata?.provider === 'google') {
      authMethod = 'google';
    } else if (session.user.app_metadata?.provider === 'apple') {
      authMethod = 'apple';
    } else if (session.user.email) {
      authMethod = 'email';
    }

    const userProfile = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name,
      avatarUrl: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
      authMethod,
    };

    logger.debug('User session found', { email: userProfile.email, authMethod });

    return userProfile;
  } catch (error) {
    logger.error('Failed to get current user', error as Error);
    return null;
  }
}
