/**
 * Validation Utility Tests
 *
 * Tests for all validation functions including title validation,
 * normalization, limit checks, and type guards.
 */

import {
  validateTitle,
  normalizeTitle,
  checkTaskLimit,
  checkItemLimit,
  isValidTask,
  isValidChecklistItem,
  isValidAppData,
  calculateStorageSize,
  checkStorageLimit,
} from './validation';

describe('validateTitle', () => {
  it('should accept valid titles (1-120 characters)', () => {
    expect(validateTitle('Valid Title')).toEqual({ valid: true });
    expect(validateTitle('A')).toEqual({ valid: true });
    expect(validateTitle('a'.repeat(120))).toEqual({ valid: true });
  });

  it('should reject empty strings', () => {
    const result = validateTitle('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('제목을 입력해주세요');
  });

  it('should reject whitespace-only strings', () => {
    const result = validateTitle('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('제목을 입력해주세요');
  });

  it('should reject titles longer than 120 characters', () => {
    const longTitle = 'a'.repeat(121);
    const result = validateTitle(longTitle);

    expect(result.valid).toBe(false);
    expect(result.error).toBe('제목은 120자 이하로 입력해주세요');
    expect(result.details).toBe('현재: 121자');
  });

  it('should trim whitespace before validation', () => {
    const result = validateTitle('  Valid Title  ');
    expect(result.valid).toBe(true);
  });

  it('should remove newlines before validation', () => {
    const result = validateTitle('Line 1\nLine 2');
    expect(result.valid).toBe(true);
  });
});

describe('normalizeTitle', () => {
  it('should trim leading and trailing whitespace', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('Hello World');
    expect(normalizeTitle('\tHello\t')).toBe('Hello');
  });

  it('should replace newlines with spaces', () => {
    expect(normalizeTitle('Line 1\nLine 2')).toBe('Line 1 Line 2');
    expect(normalizeTitle('Line 1\r\nLine 2')).toBe('Line 1 Line 2');
    expect(normalizeTitle('A\nB\nC')).toBe('A B C');
  });

  it('should collapse multiple spaces into single spaces', () => {
    expect(normalizeTitle('Too   Many    Spaces')).toBe('Too Many Spaces');
    expect(normalizeTitle('A     B')).toBe('A B');
  });

  it('should handle complex normalization', () => {
    expect(normalizeTitle('\r\n  Messy   Input\n\n  ')).toBe('Messy Input');
    expect(normalizeTitle('  \n\n  Title  \n  ')).toBe('Title');
  });

  it('should handle empty strings', () => {
    expect(normalizeTitle('')).toBe('');
  });

  it('should handle already normalized strings', () => {
    expect(normalizeTitle('Clean Title')).toBe('Clean Title');
  });
});

describe('checkTaskLimit', () => {
  it('should accept task counts below limit (200)', () => {
    expect(checkTaskLimit(0)).toEqual({ valid: true });
    expect(checkTaskLimit(100)).toEqual({ valid: true });
    expect(checkTaskLimit(150)).toEqual({ valid: true });
  });

  it('should reject task count at or above limit (200)', () => {
    const result200 = checkTaskLimit(200);
    expect(result200.valid).toBe(false);
    expect(result200.error).toBe('최대 200개의 할 일만 생성할 수 있습니다');
    expect(result200.details).toBe('완료된 할 일을 삭제하거나 백업 후 초기화하세요');

    const result250 = checkTaskLimit(250);
    expect(result250.valid).toBe(false);
  });

  it('should warn when approaching limit (90% = 180)', () => {
    const result = checkTaskLimit(180);
    expect(result.valid).toBe(true);
    expect(result.details).toContain('할 일이 200개에 가까워지고 있습니다');
  });

  it('should not warn just below threshold', () => {
    const result = checkTaskLimit(179);
    expect(result.valid).toBe(true);
    expect(result.details).toBeUndefined();
  });
});

describe('checkItemLimit', () => {
  it('should accept item counts below limit (50)', () => {
    expect(checkItemLimit(0)).toEqual({ valid: true });
    expect(checkItemLimit(25)).toEqual({ valid: true });
    expect(checkItemLimit(40)).toEqual({ valid: true });
  });

  it('should reject item count at or above limit (50)', () => {
    const result50 = checkItemLimit(50);
    expect(result50.valid).toBe(false);
    expect(result50.error).toBe('최대 50개의 항목만 추가할 수 있습니다');
    expect(result50.details).toBe('더 세분화된 작업은 새로운 할 일로 분리하세요');

    const result100 = checkItemLimit(100);
    expect(result100.valid).toBe(false);
  });

  it('should warn when approaching limit (90% = 45)', () => {
    const result = checkItemLimit(45);
    expect(result.valid).toBe(true);
    expect(result.details).toContain('체크리스트 항목이 50개에 가까워지고 있습니다');
  });

  it('should not warn just below threshold', () => {
    const result = checkItemLimit(44);
    expect(result.valid).toBe(true);
    expect(result.details).toBeUndefined();
  });
});

describe('isValidTask', () => {
  const validTask = {
    id: '123',
    title: 'Test Task',
    items: [
      { id: '1', title: 'Item 1', done: false },
    ],
    createdAt: '2025-11-06T00:00:00.000Z',
    updatedAt: '2025-11-06T00:00:00.000Z',
    schemaVersion: 1,
  };

  it('should accept valid task objects', () => {
    expect(isValidTask(validTask)).toBe(true);
  });

  it('should accept tasks without schemaVersion', () => {
    const { schemaVersion, ...taskWithoutVersion } = validTask;
    expect(isValidTask(taskWithoutVersion)).toBe(true);
  });

  it('should accept tasks with empty items array', () => {
    expect(isValidTask({ ...validTask, items: [] })).toBe(true);
  });

  it('should reject null or undefined', () => {
    expect(isValidTask(null)).toBe(false);
    expect(isValidTask(undefined)).toBe(false);
  });

  it('should reject non-object values', () => {
    expect(isValidTask('string')).toBe(false);
    expect(isValidTask(123)).toBe(false);
    expect(isValidTask([])).toBe(false);
  });

  it('should reject tasks with missing required fields', () => {
    expect(isValidTask({ ...validTask, id: undefined })).toBe(false);
    expect(isValidTask({ ...validTask, title: undefined })).toBe(false);
    expect(isValidTask({ ...validTask, createdAt: undefined })).toBe(false);
    expect(isValidTask({ ...validTask, updatedAt: undefined })).toBe(false);
  });

  it('should reject tasks with invalid field types', () => {
    expect(isValidTask({ ...validTask, id: 123 })).toBe(false);
    expect(isValidTask({ ...validTask, title: 123 })).toBe(false);
    expect(isValidTask({ ...validTask, items: 'not-array' })).toBe(false);
    expect(isValidTask({ ...validTask, schemaVersion: 'not-number' })).toBe(false);
  });

  it('should reject tasks with invalid items', () => {
    const invalidTask = {
      ...validTask,
      items: [{ id: '1', title: 'Item 1' }], // Missing 'done'
    };
    expect(isValidTask(invalidTask)).toBe(false);
  });
});

describe('isValidChecklistItem', () => {
  const validItem = {
    id: '1',
    title: 'Test Item',
    done: false,
  };

  it('should accept valid checklist items', () => {
    expect(isValidChecklistItem(validItem)).toBe(true);
    expect(isValidChecklistItem({ ...validItem, done: true })).toBe(true);
  });

  it('should reject null or undefined', () => {
    expect(isValidChecklistItem(null)).toBe(false);
    expect(isValidChecklistItem(undefined)).toBe(false);
  });

  it('should reject non-object values', () => {
    expect(isValidChecklistItem('string')).toBe(false);
    expect(isValidChecklistItem(123)).toBe(false);
  });

  it('should reject items with missing required fields', () => {
    expect(isValidChecklistItem({ ...validItem, id: undefined })).toBe(false);
    expect(isValidChecklistItem({ ...validItem, title: undefined })).toBe(false);
    expect(isValidChecklistItem({ ...validItem, done: undefined })).toBe(false);
  });

  it('should reject items with invalid field types', () => {
    expect(isValidChecklistItem({ ...validItem, id: 123 })).toBe(false);
    expect(isValidChecklistItem({ ...validItem, title: 123 })).toBe(false);
    expect(isValidChecklistItem({ ...validItem, done: 'true' })).toBe(false);
  });

  it('should reject items with empty string id or title', () => {
    expect(isValidChecklistItem({ ...validItem, id: '' })).toBe(false);
    expect(isValidChecklistItem({ ...validItem, title: '' })).toBe(false);
  });
});

describe('isValidAppData', () => {
  const validAppData = {
    schemaVersion: 1,
    tasks: [
      {
        id: '123',
        title: 'Task 1',
        items: [],
        createdAt: '2025-11-06T00:00:00.000Z',
        updatedAt: '2025-11-06T00:00:00.000Z',
      },
    ],
  };

  it('should accept valid AppData', () => {
    expect(isValidAppData(validAppData)).toBe(true);
  });

  it('should accept AppData with empty tasks array', () => {
    expect(isValidAppData({ schemaVersion: 1, tasks: [] })).toBe(true);
  });

  it('should reject null or undefined', () => {
    expect(isValidAppData(null)).toBe(false);
    expect(isValidAppData(undefined)).toBe(false);
  });

  it('should reject AppData with missing schemaVersion', () => {
    expect(isValidAppData({ tasks: [] })).toBe(false);
  });

  it('should reject AppData with invalid schemaVersion', () => {
    expect(isValidAppData({ schemaVersion: 'not-number', tasks: [] })).toBe(false);
    expect(isValidAppData({ schemaVersion: 0, tasks: [] })).toBe(false);
    expect(isValidAppData({ schemaVersion: -1, tasks: [] })).toBe(false);
  });

  it('should reject AppData with non-array tasks', () => {
    expect(isValidAppData({ schemaVersion: 1, tasks: 'not-array' })).toBe(false);
    expect(isValidAppData({ schemaVersion: 1, tasks: {} })).toBe(false);
  });

  it('should reject AppData with invalid tasks', () => {
    const invalidAppData = {
      schemaVersion: 1,
      tasks: [
        { id: '123', title: 'Invalid Task' }, // Missing required fields
      ],
    };
    expect(isValidAppData(invalidAppData)).toBe(false);
  });
});

describe('calculateStorageSize', () => {
  it('should calculate size for simple objects', () => {
    const data = { key: 'value' };
    const size = calculateStorageSize(data);
    expect(size).toBeGreaterThan(0);
  });

  it('should calculate size for AppData', () => {
    const appData = {
      schemaVersion: 1,
      tasks: [],
    };
    const size = calculateStorageSize(appData);
    expect(size).toBeGreaterThan(0);
  });

  it('should return larger size for larger data', () => {
    const smallData = { tasks: [] };
    const largeData = {
      tasks: Array(100).fill({
        id: '123',
        title: 'Test Task',
        items: Array(10).fill({ id: '1', title: 'Item', done: false }),
      }),
    };

    const smallSize = calculateStorageSize(smallData);
    const largeSize = calculateStorageSize(largeData);

    expect(largeSize).toBeGreaterThan(smallSize);
  });

  it('should handle empty objects', () => {
    const size = calculateStorageSize({});
    expect(size).toBeGreaterThan(0);
  });

  it('should return 0 for circular references (serialization failure)', () => {
    const circular: any = { a: 1 };
    circular.self = circular;
    const size = calculateStorageSize(circular);
    expect(size).toBe(0);
  });
});

describe('checkStorageLimit', () => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  it('should accept sizes well below limit', () => {
    const result = checkStorageLimit(1024 * 1024); // 1MB
    expect(result.valid).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it('should reject sizes at or above limit', () => {
    const result = checkStorageLimit(MAX_SIZE);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('저장 공간이 부족합니다');
    expect(result.details).toBe('완료된 할 일을 삭제하거나 백업 후 초기화하세요');
  });

  it('should reject sizes above limit', () => {
    const result = checkStorageLimit(MAX_SIZE + 1);
    expect(result.valid).toBe(false);
  });

  it('should warn when approaching limit (90% = 4.5MB)', () => {
    const result = checkStorageLimit(4.5 * 1024 * 1024);
    expect(result.valid).toBe(true);
    expect(result.details).toContain('저장 공간이');
    expect(result.details).toContain('가까워지고 있습니다');
  });

  it('should not warn just below threshold', () => {
    const result = checkStorageLimit(4 * 1024 * 1024); // 4MB (80%)
    expect(result.valid).toBe(true);
    expect(result.details).toBeUndefined();
  });

  it('should handle zero size', () => {
    const result = checkStorageLimit(0);
    expect(result.valid).toBe(true);
  });
});
