/**
 * Progress Calculation Utility Tests
 *
 * Tests for the calcProgress function that calculates task completion progress.
 */

import { calcProgress } from './progress';
import { Task } from '../types';

describe('calcProgress', () => {
  const createMockTask = (items: Array<{ done: boolean }>): Task => ({
    id: 'test-task-id',
    title: 'Test Task',
    items: items.map((item, index) => ({
      id: `item-${index}`,
      title: `Item ${index}`,
      done: item.done,
    })),
    createdAt: '2025-11-06T00:00:00.000Z',
    updatedAt: '2025-11-06T00:00:00.000Z',
    schemaVersion: 1,
  });

  describe('Empty items array', () => {
    it('should return 0% progress for task with no items', () => {
      const task = createMockTask([]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 0,
        total: 0,
        percent: 0,
      });
    });

    it('should return 0% progress for task with undefined items', () => {
      const task = {
        ...createMockTask([]),
        items: undefined as any,
      };
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 0,
        total: 0,
        percent: 0,
      });
    });
  });

  describe('All items completed', () => {
    it('should return 100% progress when all items are done', () => {
      const task = createMockTask([{ done: true }, { done: true }, { done: true }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 3,
        total: 3,
        percent: 100,
      });
    });

    it('should return 100% progress for single completed item', () => {
      const task = createMockTask([{ done: true }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 1,
        total: 1,
        percent: 100,
      });
    });
  });

  describe('No items completed', () => {
    it('should return 0% progress when no items are done', () => {
      const task = createMockTask([{ done: false }, { done: false }, { done: false }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 0,
        total: 3,
        percent: 0,
      });
    });
  });

  describe('Partial completion', () => {
    it('should calculate correct percentage for 3 out of 5 items', () => {
      const task = createMockTask([
        { done: true },
        { done: true },
        { done: true },
        { done: false },
        { done: false },
      ]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 3,
        total: 5,
        percent: 60,
      });
    });

    it('should calculate correct percentage for 1 out of 3 items', () => {
      const task = createMockTask([{ done: true }, { done: false }, { done: false }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 1,
        total: 3,
        percent: 33, // Math.round(1/3 * 100) = 33
      });
    });

    it('should calculate correct percentage for 2 out of 3 items', () => {
      const task = createMockTask([{ done: true }, { done: true }, { done: false }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 2,
        total: 3,
        percent: 67, // Math.round(2/3 * 100) = 67
      });
    });

    it('should round percentages correctly', () => {
      // 1/7 = 14.285... should round to 14
      const task = createMockTask([
        { done: true },
        { done: false },
        { done: false },
        { done: false },
        { done: false },
        { done: false },
        { done: false },
      ]);
      const progress = calcProgress(task);

      expect(progress.percent).toBe(14);
    });
  });

  describe('Large number of items', () => {
    it('should handle 50 items (max limit)', () => {
      const items = Array(50)
        .fill(null)
        .map((_, i) => ({
          done: i < 25, // First 25 completed
        }));
      const task = createMockTask(items);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 25,
        total: 50,
        percent: 50,
      });
    });

    it('should handle tasks with many items efficiently', () => {
      const items = Array(100)
        .fill(null)
        .map((_, i) => ({
          done: i % 3 === 0, // Every third item completed
        }));
      const task = createMockTask(items);
      const progress = calcProgress(task);

      expect(progress.done).toBe(34); // 100/3 rounded up = 34
      expect(progress.total).toBe(100);
      expect(progress.percent).toBe(34);
    });
  });

  describe('Edge cases', () => {
    it('should handle task with single incomplete item', () => {
      const task = createMockTask([{ done: false }]);
      const progress = calcProgress(task);

      expect(progress).toEqual({
        done: 0,
        total: 1,
        percent: 0,
      });
    });

    it('should not mutate the original task object', () => {
      const task = createMockTask([{ done: true }, { done: false }]);
      const originalItemsLength = task.items.length;
      const originalDoneCount = task.items.filter((item) => item.done).length;

      calcProgress(task);

      expect(task.items.length).toBe(originalItemsLength);
      expect(task.items.filter((item) => item.done).length).toBe(originalDoneCount);
    });
  });
});
