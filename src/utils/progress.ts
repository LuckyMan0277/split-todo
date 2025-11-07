/**
 * Progress Calculation Utility Module
 *
 * Provides functions to calculate task completion progress
 * based on the number of completed checklist items.
 */

import { Task, Progress } from '../types';

/**
 * Calculates the completion progress for a given task.
 *
 * Computes the number of completed items, total items, and completion
 * percentage. Handles edge cases like empty item arrays gracefully.
 *
 * @param task - The task to calculate progress for
 * @returns Progress object containing done count, total count, and percentage
 *
 * @example
 * // Task with 3 out of 5 items completed
 * const task = {
 *   id: '123',
 *   title: 'Website Redesign',
 *   items: [
 *     { id: '1', title: 'Design mockup', done: true },
 *     { id: '2', title: 'Frontend', done: true },
 *     { id: '3', title: 'Backend', done: true },
 *     { id: '4', title: 'Testing', done: false },
 *     { id: '5', title: 'Deploy', done: false },
 *   ],
 *   createdAt: '2025-11-06T00:00:00.000Z',
 *   updatedAt: '2025-11-06T12:00:00.000Z',
 * };
 *
 * const progress = calcProgress(task);
 * // Returns: { done: 3, total: 5, percent: 60 }
 *
 * @example
 * // Task with no items (empty array)
 * const emptyTask = {
 *   id: '456',
 *   title: 'New Project',
 *   items: [],
 *   createdAt: '2025-11-06T00:00:00.000Z',
 *   updatedAt: '2025-11-06T00:00:00.000Z',
 * };
 *
 * const emptyProgress = calcProgress(emptyTask);
 * // Returns: { done: 0, total: 0, percent: 0 }
 *
 * @example
 * // Task with all items completed
 * const completedTask = {
 *   id: '789',
 *   title: 'Completed Task',
 *   items: [
 *     { id: '1', title: 'Step 1', done: true },
 *     { id: '2', title: 'Step 2', done: true },
 *   ],
 *   createdAt: '2025-11-06T00:00:00.000Z',
 *   updatedAt: '2025-11-06T12:00:00.000Z',
 * };
 *
 * const completedProgress = calcProgress(completedTask);
 * // Returns: { done: 2, total: 2, percent: 100 }
 */
export function calcProgress(task: Task): Progress {
  // Handle empty items array - return 0% progress
  if (!task.items || task.items.length === 0) {
    return {
      done: 0,
      total: 0,
      percent: 0,
    };
  }

  const total = task.items.length;
  const done = task.items.filter((item) => item.done).length;

  // Calculate percentage and round to nearest integer
  // Avoid division by zero (already handled above, but safe guard)
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    done,
    total,
    percent,
  };
}
