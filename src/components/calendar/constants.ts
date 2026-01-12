/**
 * Calendar Layout Constants
 * Shared constants for all calendar components
 */

import { Dimensions } from 'react-native';

// Screen dimensions
export const SCREEN_WIDTH = Dimensions.get('window').width;

// Day names
export const DAY_NAMES_SHORT = ['일', '월', '화', '수', '목', '금', '토'];

// Header heights
export const MONTH_HEADER_HEIGHT = 32;
export const DAY_HEADER_HEIGHT = 48;

// Spacing
export const CELL_SPACING = 4; // Spacing between cells
export const EDGE_MARGIN = CELL_SPACING; // Margin from screen edges
export const WEEK_ROW_PADDING = 2; // Vertical padding for week rows
export const BOTTOM_PADDING = 8; // Bottom padding for calendar

// Cell dimensions
export const CELL_WIDTH = (SCREEN_WIDTH - EDGE_MARGIN * 2 - CELL_SPACING * 6) / 7;
export const CELL_HEIGHT = CELL_WIDTH; // Square cells

// Gesture thresholds
export const GESTURE_MIN_DISTANCE = 10; // Minimum distance to recognize gesture
export const SWIPE_THRESHOLD = 50; // Minimum distance for swipe navigation
export const SNAP_THRESHOLD = 0.5; // Snap to expanded/collapsed at 50%

/**
 * Calculate weekly calendar height
 */
export const WEEKLY_CALENDAR_HEIGHT =
  MONTH_HEADER_HEIGHT + DAY_HEADER_HEIGHT + CELL_HEIGHT + WEEK_ROW_PADDING * 2 + BOTTOM_PADDING;

/**
 * Calculate monthly calendar height based on number of weeks
 */
export const calculateMonthlyHeight = (weekCount: number): number => {
  return (
    MONTH_HEADER_HEIGHT +
    DAY_HEADER_HEIGHT +
    (CELL_HEIGHT + WEEK_ROW_PADDING * 2) * weekCount +
    BOTTOM_PADDING
  );
};

// Default monthly height (5 weeks - most common)
export const MONTHLY_CALENDAR_HEIGHT = calculateMonthlyHeight(5);
