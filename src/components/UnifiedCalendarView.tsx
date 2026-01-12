/**
 * UnifiedCalendarView Component
 *
 * Unified calendar component that renders all dates with position-based animations.
 * Dates smoothly transition from weekly to monthly layout during drag gestures.
 *
 * Features:
 * - All dates always rendered with individual animations
 * - Position interpolation based on drag progress (0-1)
 * - Current week dates move from weekly to monthly positions
 * - Other week dates fade in during expansion
 * - Smooth transitions with native driver support
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native';
import { colors } from '../styles/colors';
import { logger } from '../utils/logger';
import { formatDateToKey } from '../services/dailyRecords';
import {
  DAY_NAMES_SHORT,
  MONTH_HEADER_HEIGHT as HEADER_HEIGHT,
  DAY_HEADER_HEIGHT,
  CELL_SPACING,
  EDGE_MARGIN,
  CELL_WIDTH,
  CELL_HEIGHT,
  WEEK_ROW_PADDING,
  WEEKLY_CALENDAR_HEIGHT,
  MONTHLY_CALENDAR_HEIGHT,
  calculateMonthlyHeight,
} from './calendar/constants';
import {
  getWeekStart,
  navigateMonth,
  calculateWeeklyPosition,
  calculateMonthlyPosition,
  createDayInfo,
  getCompletionDotColor,
  getDayNumberColor,
} from './calendar/utils';
import { DayInfo } from './calendar/types';

// Re-export for backward compatibility
export const calculateMonthlyCalendarHeight = calculateMonthlyHeight;
export { WEEKLY_CALENDAR_HEIGHT, MONTHLY_CALENDAR_HEIGHT };

interface UnifiedCalendarViewProps {
  selectedDate: string;
  onDateSelect: (dateKey: string) => void;
  weekStartsOn: 0 | 1;
  dragProgress: Animated.Value; // 0 = collapsed (week), 1 = expanded (month)
  currentMonth: string; // Display month string
  isExpanded: boolean; // Whether calendar is in expanded (month) view
  displayDate: string; // Date to display calendar for (YYYY-MM-DD)
  onDisplayDateChange: (newDate: string) => void; // Callback when display date changes
  onMonthHeightChange?: (height: number) => void; // Callback when month height changes
}

export const UnifiedCalendarView: React.FC<UnifiedCalendarViewProps> = ({
  selectedDate,
  onDateSelect,
  weekStartsOn,
  dragProgress,
  currentMonth,
  isExpanded,
  displayDate,
  onDisplayDateChange,
  onMonthHeightChange,
}) => {
  const [allDays, setAllDays] = useState<DayInfo[]>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  /**
   * Navigate to previous month
   */
  const handlePreviousMonth = useCallback(() => {
    const newDateKey = navigateMonth(displayDate, 'prev');

    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change data
      onDisplayDateChange(newDateKey);

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    logger.debug('Navigate to previous month', { displayDate: newDateKey });
  }, [displayDate, onDisplayDateChange, fadeAnim]);

  /**
   * Navigate to next month
   */
  const handleNextMonth = useCallback(() => {
    const newDateKey = navigateMonth(displayDate, 'next');

    // Fade out animation
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      // Change data
      onDisplayDateChange(newDateKey);

      // Fade in animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    logger.debug('Navigate to next month', { displayDate: newDateKey });
  }, [displayDate, onDisplayDateChange, fadeAnim]);

  /**
   * Generates all days for the month containing display date
   */
  const loadAllDays = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayKey = formatDateToKey(today);

      const displayDateObj = new Date(displayDate);
      displayDateObj.setHours(0, 0, 0, 0);
      const currentYear = displayDateObj.getFullYear();
      const currentMonthNum = displayDateObj.getMonth();

      const selectedDateObj = new Date(selectedDate);
      selectedDateObj.setHours(0, 0, 0, 0);

      // Find the current week
      const currentWeekStart = getWeekStart(selectedDateObj, weekStartsOn);

      // Find first day of the month
      const firstDayOfMonth = new Date(currentYear, currentMonthNum, 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      // Find the start of the week containing the first day
      const monthStartWeek = getWeekStart(firstDayOfMonth, weekStartsOn);

      // Generate up to 6 weeks (enough to cover any month)
      const days: DayInfo[] = [];

      for (let weekNum = 0; weekNum < 6; weekNum++) {
        const weekDate = new Date(monthStartWeek);
        weekDate.setDate(monthStartWeek.getDate() + weekNum * 7);

        let hasCurrentMonthDays = false;

        for (let dayNum = 0; dayNum < 7; dayNum++) {
          const date = new Date(weekDate);
          date.setDate(weekDate.getDate() + dayNum);
          date.setHours(0, 0, 0, 0);

          const isCurrentMonth =
            date.getMonth() === currentMonthNum && date.getFullYear() === currentYear;
          if (isCurrentMonth) {
            hasCurrentMonthDays = true;
          }

          const dayInfo = await createDayInfo(
            date,
            currentWeekStart,
            currentMonthNum,
            currentYear,
            todayKey,
            weekNum,
            dayNum
          );

          days.push(dayInfo);
        }

        // Stop after the last week containing current month days
        if (hasCurrentMonthDays && weekNum > 0 && !days.slice(-7).some((d) => d.isCurrentMonth)) {
          break;
        }
      }

      // Filter to only include weeks with current month days
      const filteredDays = days.filter((day) => {
        const weekStart = day.weekRowIndex * 7;
        const weekEnd = weekStart + 7;
        const weekDays = days.slice(weekStart, weekEnd);
        return weekDays.some((d) => d.isCurrentMonth);
      });

      setAllDays(filteredDays);

      // Calculate week count and notify parent about height change
      const weekCount = Math.ceil(filteredDays.length / 7);
      const monthHeight = calculateMonthlyCalendarHeight(weekCount);

      if (onMonthHeightChange) {
        onMonthHeightChange(monthHeight);
      }

      logger.debug('All days loaded', {
        count: filteredDays.length,
        weeks: weekCount,
        monthHeight,
      });
    } catch (error) {
      logger.error('Failed to load all days', error as Error);
    }
  }, [displayDate, selectedDate, weekStartsOn, onMonthHeightChange]);

  /**
   * Load all days when component mounts or dependencies change
   */
  useEffect(() => {
    loadAllDays();
  }, [loadAllDays]);

  /**
   * Pan responder for horizontal swipe gestures (only when expanded)
   * Uses capture phase to intercept horizontal gestures before parent's vertical handler
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to horizontal swipes when expanded
          if (!isExpanded) {
            return false;
          }
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const hasMinDistance = Math.abs(gestureState.dx) > 30;
          const shouldRespond = isHorizontal && hasMinDistance;

          if (shouldRespond) {
            logger.debug('UnifiedCalendarView will handle horizontal gesture', {
              dx: gestureState.dx,
              dy: gestureState.dy,
              isExpanded,
            });
          }

          return shouldRespond;
        },
        onMoveShouldSetPanResponderCapture: (_, gestureState) => {
          // Use capture phase to intercept horizontal gestures before parent
          if (!isExpanded) {
            return false;
          }
          const isHorizontal = Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
          const hasMinDistance = Math.abs(gestureState.dx) > 30;
          return isHorizontal && hasMinDistance;
        },
        onPanResponderGrant: () => {
          logger.debug('UnifiedCalendarView gesture granted');
        },
        onPanResponderRelease: (_, gestureState) => {
          const { dx } = gestureState;

          logger.debug('Horizontal swipe completed', {
            dx,
            isExpanded,
          });

          // Swipe left -> next month
          if (dx < -50) {
            handleNextMonth();
          }
          // Swipe right -> previous month
          else if (dx > 50) {
            handlePreviousMonth();
          }
        },
      }),
    [isExpanded, handleNextMonth, handlePreviousMonth]
  );

  /**
   * Calculate weekly position - delegates to util function
   */
  const getWeeklyPosForDay = useCallback((day: DayInfo) => {
    if (!day.isCurrentWeek) {
      // Non-current week dates are positioned at monthly position
      return calculateMonthlyPosition(day.dayColumnIndex, day.weekRowIndex);
    }
    return calculateWeeklyPosition(day.dayColumnIndex);
  }, []);

  /**
   * Calculate monthly position - delegates to util function
   */
  const getMonthlyPosForDay = useCallback(
    (day: DayInfo) => calculateMonthlyPosition(day.dayColumnIndex, day.weekRowIndex),
    []
  );

  /**
   * Renders day name headers
   */
  const renderDayHeaders = () => {
    const headers = [];
    for (let i = 0; i < 7; i++) {
      const dayIndex = (weekStartsOn + i) % 7;
      const dayName = DAY_NAMES_SHORT[dayIndex];
      const isSaturday = dayIndex === 6;
      const isSunday = dayIndex === 0;

      let headerColor = colors.textSecondary;
      if (isSaturday) {
        headerColor = '#3b82f6'; // Blue
      } else if (isSunday) {
        headerColor = '#ef4444'; // Red
      }

      headers.push(
        <View key={dayIndex} style={[styles.dayHeaderCell, { width: CELL_WIDTH }]}>
          <Text style={[styles.dayHeaderText, { color: headerColor }]}>{dayName}</Text>
        </View>
      );
    }
    return <View style={styles.dayHeaderRow}>{headers}</View>;
  };

  /**
   * Renders a single animated day cell
   */
  const renderDay = (day: DayInfo) => {
    const isSelected = day.dateKey === selectedDate;

    // Use utility functions for colors
    const dotColor = getCompletionDotColor(day, colors.primary);
    const dayNumberColor = getDayNumberColor(
      day,
      isSelected,
      colors.surface,
      colors.textPrimary,
      colors.textSecondary
    );

    // Calculate positions using utility functions
    const weeklyPos = getWeeklyPosForDay(day);
    const monthlyPos = getMonthlyPosForDay(day);

    // Interpolate position based on drag progress
    const translateX = dragProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [weeklyPos.x, monthlyPos.x],
    });

    const translateY = dragProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [weeklyPos.y, monthlyPos.y],
    });

    // Opacity for non-current week dates (fade in during expansion, fade out during collapse)
    // Starts fading in at 60% expansion progress for a smoother transition
    const opacity = day.isCurrentWeek
      ? 1
      : dragProgress.interpolate({
          inputRange: [0, 0.6, 0.8, 1],
          outputRange: [0, 0, 0.5, 1],
        });

    // Scale animation for subtle effect during transition
    // Current week dates scale slightly during transition for visual feedback
    const scale = day.isCurrentWeek
      ? dragProgress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [1, 0.98, 1],
        })
      : 1;

    // Opacity for other month dates
    const otherMonthOpacity = day.isCurrentMonth ? 1 : 0.5;

    return (
      <Animated.View
        key={day.dateKey}
        style={[
          styles.dayCardContainer,
          {
            width: CELL_WIDTH,
            height: CELL_HEIGHT,
            transform: [{ translateX }, { translateY }, { scale }],
            opacity,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.dayCard,
            isSelected && styles.dayCardSelected,
            !day.isCurrentMonth && styles.dayCardOtherMonth,
            { opacity: otherMonthOpacity },
          ]}
          onPress={() => onDateSelect(day.dateKey)}
          accessible={true}
          accessibilityLabel={`${day.dayOfWeek}요일 ${day.dayNumber}일`}
          accessibilityRole="button"
        >
          <Text style={[styles.dayNumber, { color: dayNumberColor }]}>{day.dayNumber}</Text>
          {dotColor && <View style={[styles.dot, { backgroundColor: dotColor }]} />}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Month Header with navigation */}
      <View style={styles.monthHeader}>
        {isExpanded && (
          <TouchableOpacity
            style={[styles.monthNavButton, styles.monthNavButtonLeft]}
            onPress={handlePreviousMonth}
            accessible={true}
            accessibilityLabel="이전 달"
            accessibilityRole="button"
          >
            <Text style={styles.monthNavText}>‹</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.monthText}>{currentMonth}</Text>
        {isExpanded && (
          <TouchableOpacity
            style={[styles.monthNavButton, styles.monthNavButtonRight]}
            onPress={handleNextMonth}
            accessible={true}
            accessibilityLabel="다음 달"
            accessibilityRole="button"
          >
            <Text style={styles.monthNavText}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Day name headers */}
      {renderDayHeaders()}

      {/* All day cells with position-based animations */}
      <Animated.View
        style={[styles.daysContainer, { opacity: fadeAnim }]}
        {...panResponder.panHandlers}
      >
        {allDays.map(renderDay)}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },

  monthHeader: {
    height: HEADER_HEIGHT,
    paddingVertical: 4,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  monthNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },

  monthNavButtonLeft: {
    left: 0,
  },

  monthNavButtonRight: {
    right: 0,
  },

  monthNavText: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.textPrimary,
  },

  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DAY_HEADER_HEIGHT,
    paddingHorizontal: EDGE_MARGIN,
    marginBottom: 0,
  },

  dayHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: CELL_SPACING,
  },

  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  daysContainer: {
    flex: 1,
    paddingVertical: WEEK_ROW_PADDING,
  },

  dayCardContainer: {
    position: 'absolute',
    // No padding - spacing handled by position calculation
  },

  dayCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },

  dayCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  dayCardOtherMonth: {
    // Opacity handled in component
  },

  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
  },

  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
});
