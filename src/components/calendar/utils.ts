/**
 * Calendar Utility Functions
 * Shared utilities for calendar calculations
 */

import { formatDateToKey, getDailyRecord } from '../../services/dailyRecords';
import {
  CELL_WIDTH,
  CELL_HEIGHT,
  CELL_SPACING,
  EDGE_MARGIN,
  WEEK_ROW_PADDING,
  DAY_NAMES_SHORT,
} from './constants';
import { DayInfo, Position } from './types';

/**
 * Get the start of the week for a given date
 */
export const getWeekStart = (date: Date, weekStartsOn: 0 | 1): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day - weekStartsOn;
  const adjustedDiff = diff < 0 ? diff + 7 : diff;
  d.setDate(d.getDate() - adjustedDiff);
  return d;
};

/**
 * Normalize date to midnight
 */
export const normalizeDateToMidnight = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Calculate number of weeks needed for a given month
 */
export const calculateWeekCountForMonth = (
  year: number,
  month: number,
  weekStartsOn: 0 | 1
): number => {
  const firstDay = new Date(year, month, 1);
  firstDay.setHours(0, 0, 0, 0);

  const lastDay = new Date(year, month + 1, 0);
  lastDay.setHours(0, 0, 0, 0);

  const firstWeekStart = getWeekStart(firstDay, weekStartsOn);
  const daysDiff = Math.ceil(
    (lastDay.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.ceil(daysDiff / 7);
};

/**
 * Navigate to previous/next week
 */
export const navigateWeek = (currentDate: string, direction: 'prev' | 'next'): string => {
  const date = new Date(currentDate);
  const offset = direction === 'prev' ? -7 : 7;
  date.setDate(date.getDate() + offset);
  return formatDateToKey(date);
};

/**
 * Navigate to previous/next month
 */
export const navigateMonth = (currentDate: string, direction: 'prev' | 'next'): string => {
  const date = new Date(currentDate);
  const offset = direction === 'prev' ? -1 : 1;
  date.setMonth(date.getMonth() + offset);
  date.setDate(1); // Set to first day of month
  return formatDateToKey(date);
};

/**
 * Format date for month display (e.g., "2025년 1월")
 */
export const formatMonthDisplay = (dateKey: string): string => {
  const date = new Date(dateKey);
  const year = date.getFullYear();
  const month = date.getMonth();
  const monthNames = [
    '1월',
    '2월',
    '3월',
    '4월',
    '5월',
    '6월',
    '7월',
    '8월',
    '9월',
    '10월',
    '11월',
    '12월',
  ];
  return `${year}년 ${monthNames[month]}`;
};

/**
 * Create DayInfo object for a single day
 */
export const createDayInfo = async (
  date: Date,
  currentWeekStart: Date,
  currentMonthNum: number,
  currentYear: number,
  todayKey: string,
  weekRowIndex: number,
  dayColumnIndex: number
): Promise<DayInfo> => {
  const dateKey = formatDateToKey(date);
  const dayOfWeek = DAY_NAMES_SHORT[date.getDay()];
  const dayNumber = date.getDate();

  const today = normalizeDateToMidnight(new Date());
  const isToday = dateKey === todayKey;
  const isPast = date < today;
  const isFuture = date > today;
  const isSaturday = date.getDay() === 6;
  const isSunday = date.getDay() === 0;
  const isCurrentMonth = date.getMonth() === currentMonthNum && date.getFullYear() === currentYear;

  const weekEnd = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isCurrentWeek = date >= currentWeekStart && date < weekEnd;

  // Load record for past days and today
  let record;
  if (isPast || isToday) {
    record = await getDailyRecord(dateKey);
  }

  return {
    date,
    dateKey,
    dayOfWeek,
    dayNumber,
    isToday,
    isPast,
    isFuture,
    isSaturday,
    isSunday,
    isCurrentMonth,
    isCurrentWeek,
    weekRowIndex,
    dayColumnIndex,
    record,
  };
};

/**
 * Calculate position for a day in weekly layout
 */
export const calculateWeeklyPosition = (dayColumnIndex: number): Position => {
  return {
    x: EDGE_MARGIN + dayColumnIndex * (CELL_WIDTH + CELL_SPACING),
    y: 0,
  };
};

/**
 * Calculate position for a day in monthly layout
 */
export const calculateMonthlyPosition = (
  dayColumnIndex: number,
  weekRowIndex: number
): Position => {
  return {
    x: EDGE_MARGIN + dayColumnIndex * (CELL_WIDTH + CELL_SPACING),
    y: weekRowIndex * (CELL_HEIGHT + WEEK_ROW_PADDING * 2),
  };
};

/**
 * Determine gesture direction
 */
export const getGestureDirection = (dx: number, dy: number): 'horizontal' | 'vertical' | null => {
  if (Math.abs(dx) > Math.abs(dy)) {
    return 'horizontal';
  } else if (Math.abs(dy) > Math.abs(dx)) {
    return 'vertical';
  }
  return null;
};

/**
 * Determine if gesture is primarily horizontal
 */
export const isHorizontalGesture = (dx: number, dy: number): boolean => {
  return getGestureDirection(dx, dy) === 'horizontal';
};

/**
 * Determine if gesture is primarily vertical
 */
export const isVerticalGesture = (dx: number, dy: number): boolean => {
  return getGestureDirection(dx, dy) === 'vertical';
};

/**
 * Get completion dot color based on record
 */
export const getCompletionDotColor = (day: DayInfo, primaryColor: string): string | null => {
  if (day.isToday) {
    return primaryColor;
  }

  if (day.isPast && day.record) {
    if (day.record.totalCount === 0) {
      return '#9CA3AF'; // Gray for no items
    } else if (day.record.completionRate === 100) {
      return '#10B981'; // Green for completed
    } else if (day.record.completionRate > 0) {
      return '#FFA500'; // Orange for partial
    } else {
      return '#EF4444'; // Red for not completed
    }
  }

  return null;
};

/**
 * Get day number text color
 */
export const getDayNumberColor = (
  day: DayInfo,
  isSelected: boolean,
  surfaceColor: string,
  textPrimary: string,
  textSecondary: string
): string => {
  if (isSelected) {
    return surfaceColor;
  }
  if (day.isFuture || !day.isCurrentMonth) {
    return textSecondary;
  }
  return textPrimary;
};
