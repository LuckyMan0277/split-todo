/**
 * Calendar Component Types
 * Shared type definitions for calendar components
 */

import { DailyRecord } from '../../types';

/**
 * Day information for rendering calendar cells
 */
export interface DayInfo {
  date: Date;
  dateKey: string;
  dayOfWeek: string;
  dayNumber: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isCurrentMonth: boolean;
  isCurrentWeek: boolean;
  weekRowIndex: number;
  dayColumnIndex: number;
  record?: DailyRecord;
}

/**
 * Position in calendar grid
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Gesture direction
 */
export type GestureDirection = 'horizontal' | 'vertical';

/**
 * Navigation direction
 */
export type NavigationDirection = 'prev' | 'next';
