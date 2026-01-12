/**
 * WeeklyCalendarNavigation Component
 *
 * Expandable calendar with smooth position-based animations.
 * Uses UnifiedCalendarView for seamless weekly to monthly transitions.
 *
 * Features:
 * - Drag down to expand from week to month view
 * - Drag up to collapse from month to week view
 * - Position-based animations for each date
 * - Current week dates move to monthly positions
 * - Other week dates fade in during expansion
 * - Smooth gesture handling with PanResponder
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, Animated, PanResponder } from 'react-native';
import { logger } from '../utils/logger';
import {
  UnifiedCalendarView,
  WEEKLY_CALENDAR_HEIGHT,
  MONTHLY_CALENDAR_HEIGHT,
} from './UnifiedCalendarView';
import { GESTURE_MIN_DISTANCE, SNAP_THRESHOLD } from './calendar/constants';
import { formatMonthDisplay } from './calendar/utils';

// Height constants calculated from cell dimensions
const COLLAPSED_HEIGHT = WEEKLY_CALENDAR_HEIGHT; // Week view height
const EXPANDED_HEIGHT = MONTHLY_CALENDAR_HEIGHT; // Month view height

interface WeeklyCalendarNavigationProps {
  /**
   * Currently selected date (YYYY-MM-DD)
   */
  selectedDate: string;

  /**
   * Callback when a date is selected
   */
  onDateSelect: (date: string) => void;

  /**
   * Week starts on Sunday (0) or Monday (1)
   */
  weekStartsOn: 0 | 1;
}

export const WeeklyCalendarNavigation: React.FC<WeeklyCalendarNavigationProps> = ({
  selectedDate,
  onDateSelect,
  weekStartsOn,
}) => {
  const [displayDate, setDisplayDate] = useState<string>(selectedDate);
  const [isExpanded, setIsExpanded] = useState(false);

  const heightAnim = useRef(new Animated.Value(COLLAPSED_HEIGHT)).current;
  const dragProgress = useRef(new Animated.Value(0)).current; // 0 = collapsed, 1 = expanded
  const dragStartHeight = useRef(COLLAPSED_HEIGHT); // Height when drag started
  const isExpandedRef = useRef(false); // Ref to track expanded state for PanResponder
  const expandedHeightRef = useRef(EXPANDED_HEIGHT); // Ref to track current expanded height

  /**
   * Update display date when selected date changes
   * - When collapsed: always sync with selected date
   * - When expanded: keep current display date for month view
   */
  useEffect(() => {
    if (!isExpanded) {
      setDisplayDate(selectedDate);
    }
  }, [selectedDate, isExpanded]);

  /**
   * Calculate current month display from displayDate
   */
  const currentMonth = useMemo(() => {
    return formatMonthDisplay(displayDate);
  }, [displayDate]);

  /**
   * Callback when display date changes (from month navigation)
   */
  const handleDisplayDateChange = useCallback((newDate: string) => {
    setDisplayDate(newDate);
  }, []);

  /**
   * Callback when month height changes (due to different number of weeks)
   */
  const handleMonthHeightChange = useCallback(
    (newHeight: number) => {
      logger.debug('Month height changed', { newHeight, isExpanded: isExpandedRef.current });
      expandedHeightRef.current = newHeight;

      // If currently expanded, animate to new height
      if (isExpandedRef.current) {
        Animated.spring(heightAnim, {
          toValue: newHeight,
          useNativeDriver: false,
          tension: 80,
          friction: 12,
        }).start();
      }
    },
    [heightAnim]
  );

  /**
   * Pan responder for vertical drag gestures (expand/collapse)
   */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        const hasMinDistance = Math.abs(gestureState.dy) > GESTURE_MIN_DISTANCE;

        // Only respond to vertical drags
        return hasMinDistance && isVertical;
      },
      onPanResponderGrant: () => {
        // Capture the current height when drag starts
        // Use dynamic expanded height instead of static constant
        dragStartHeight.current = isExpandedRef.current
          ? expandedHeightRef.current
          : COLLAPSED_HEIGHT;

        logger.debug('Drag started', {
          isExpanded: isExpandedRef.current,
          startHeight: dragStartHeight.current,
          expandedHeight: expandedHeightRef.current,
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const { dy } = gestureState;

        // Calculate new height from starting height + drag delta
        // Works for both directions:
        // - Down drag (positive dy): increases height from current position
        // - Up drag (negative dy): decreases height from current position
        const newHeight = dragStartHeight.current + dy;

        // Clamp between collapsed and expanded heights (using dynamic expanded height)
        const clampedHeight = Math.max(
          COLLAPSED_HEIGHT,
          Math.min(expandedHeightRef.current, newHeight)
        );

        // Update height immediately for real-time feedback
        heightAnim.setValue(clampedHeight);

        // Calculate and update drag progress (0 to 1)
        // This drives the position-based animations in UnifiedCalendarView
        const progress =
          (clampedHeight - COLLAPSED_HEIGHT) / (expandedHeightRef.current - COLLAPSED_HEIGHT);
        dragProgress.setValue(progress);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy } = gestureState;

        // Calculate final height after drag (using dynamic expanded height)
        const finalHeight = dragStartHeight.current + dy;
        const clampedHeight = Math.max(
          COLLAPSED_HEIGHT,
          Math.min(expandedHeightRef.current, finalHeight)
        );

        // Calculate current progress (0 to 1)
        const currentProgress =
          (clampedHeight - COLLAPSED_HEIGHT) / (expandedHeightRef.current - COLLAPSED_HEIGHT);

        logger.debug('Drag released', {
          dy,
          wasExpanded: isExpandedRef.current,
          finalHeight: clampedHeight,
          currentProgress,
          snapThreshold: SNAP_THRESHOLD,
          expandedHeight: expandedHeightRef.current,
        });

        // Decide final state based on position threshold
        // If dragged more than 50% of the way, snap to that state
        const shouldExpand = currentProgress >= SNAP_THRESHOLD;

        // Animate to final state (using dynamic expanded height)
        const toValue = shouldExpand ? expandedHeightRef.current : COLLAPSED_HEIGHT;
        const progressValue = shouldExpand ? 1 : 0;

        logger.debug('Animating to final state', {
          shouldExpand,
          toValue,
        });

        Animated.parallel([
          Animated.spring(heightAnim, {
            toValue,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
          }),
          Animated.spring(dragProgress, {
            toValue: progressValue,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }),
        ]).start();

        // Update both state and ref
        setIsExpanded(shouldExpand);
        isExpandedRef.current = shouldExpand;
      },
    })
  ).current;

  return (
    <Animated.View style={[styles.container, { height: heightAnim }]} {...panResponder.panHandlers}>
      <UnifiedCalendarView
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        weekStartsOn={weekStartsOn}
        dragProgress={dragProgress}
        currentMonth={currentMonth}
        isExpanded={isExpanded}
        displayDate={displayDate}
        onDisplayDateChange={handleDisplayDateChange}
        onMonthHeightChange={handleMonthHeightChange}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 8,
  },
});
