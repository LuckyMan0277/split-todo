/**
 * TodayScreen Component
 *
 * Displays today's checklist items with progress tracking and completion celebration.
 *
 * Features:
 * - Progress summary with percentage and counts
 * - Items grouped by parent task
 * - Real-time progress updates
 * - Haptic feedback on completion
 * - Celebration animation when all tasks are done
 * - FAB button to add/select today's items
 */

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { useTaskStore } from '../store/taskStore';
import { ChecklistItemView, ConfettiCelebration, WeeklyCalendarNavigation } from '../components';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import { Task, ChecklistItem, DailyRecord, DailyRecordItem } from '../types';
import { saveTodayRecordRealtime } from '../services/dailySaveScheduler';
import { getTodayKey, getDailyRecord } from '../services/dailyRecords';
import { logger } from '../utils/logger';

/**
 * TodayScreen navigation props
 */
interface TodayScreenProps {
  navigation: any;
}

/**
 * TodayScreen component implementation
 */
const TodayScreen: React.FC<TodayScreenProps> = ({ navigation }) => {
  const { tasks, toggleChecklistItem, unscheduleItemFromDate, getItemsForDate, settings } =
    useTaskStore();

  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());

  // Daily record for past/future dates
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [previousProgress, setPreviousProgress] = useState(0);

  /**
   * Determine date type: past, today, or future
   */
  const dateType = useMemo(() => {
    const today = getTodayKey();
    if (selectedDate === today) return 'today';
    if (selectedDate < today) return 'past';
    return 'future';
  }, [selectedDate]);

  /**
   * Load daily record for past/future dates
   */
  useEffect(() => {
    if (dateType !== 'today') {
      getDailyRecord(selectedDate)
        .then((record) => {
          setDailyRecord(record || null);
        })
        .catch((error) => {
          logger.error('Failed to load daily record', error as Error);
          setDailyRecord(null);
        });
    } else {
      setDailyRecord(null);
    }
  }, [selectedDate, dateType]);

  /**
   * Get items to display based on date type
   */
  const displayItems = useMemo(() => {
    if (dateType === 'today') {
      // Today: Get all items scheduled for selected date
      return getItemsForDate(selectedDate);
    } else if (dailyRecord && dailyRecord.items) {
      // Past/Future: Get items from daily record
      return dailyRecord.items.map((recordItem) => ({
        task: { id: recordItem.taskId, title: recordItem.taskTitle } as Task,
        item: {
          id: recordItem.id,
          title: recordItem.title,
          done: recordItem.done,
          isToday: false,
        } as ChecklistItem,
        recordItem,
      }));
    }

    return [];
  }, [dateType, selectedDate, getItemsForDate, dailyRecord, tasks]);

  // Group items by task
  const itemsByTask = useMemo(() => {
    const grouped = new Map<string, typeof displayItems>();

    displayItems.forEach((entry) => {
      const taskId = entry.task.id;
      if (!grouped.has(taskId)) {
        grouped.set(taskId, []);
      }
      grouped.get(taskId)!.push(entry);
    });

    return Array.from(grouped.values());
  }, [displayItems]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    if (displayItems.length === 0) {
      return { done: 0, total: 0, percent: 0 };
    }

    const done = displayItems.filter((entry) => entry.item.done).length;
    const total = displayItems.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    return { done, total, percent };
  }, [displayItems]);

  /**
   * Handles item toggle with real-time save
   * Only works for "today" - past dates are read-only
   */
  const handleToggleItem = useCallback(
    (taskId: string, itemId: string) => {
      if (dateType !== 'today') {
        logger.warn('Cannot toggle items for past/future dates');
        return;
      }

      toggleChecklistItem(taskId, itemId);

      // Save today's record in real-time
      const updatedTasks = useTaskStore.getState().tasks;
      saveTodayRecordRealtime(updatedTasks).catch((error) => {
        logger.error('Failed to save today record', error as Error);
      });
    },
    [toggleChecklistItem, dateType]
  );

  /**
   * Handles removing item from selected date's list
   * Only works for "today" - past dates are read-only
   */
  const handleRemoveFromToday = useCallback(
    (taskId: string, itemId: string) => {
      if (dateType !== 'today') {
        logger.warn('Cannot remove items from past/future dates');
        return;
      }

      // Unschedule item from selected date
      unscheduleItemFromDate(taskId, itemId, selectedDate);

      // Save today's record in real-time
      const updatedTasks = useTaskStore.getState().tasks;
      saveTodayRecordRealtime(updatedTasks, selectedDate).catch((error) => {
        logger.error('Failed to save today record', error as Error);
      });

      logger.debug('Item removed from date', { taskId, itemId, date: selectedDate });
    },
    [unscheduleItemFromDate, selectedDate, dateType]
  );

  /**
   * Navigates to today select screen (only for today)
   */
  const handleSelectPress = useCallback(() => {
    if (dateType === 'today') {
      navigation.navigate('TodaySelect');
    } else if (dateType === 'future') {
      // TODO: Navigate to future date planning screen
      logger.debug('Future date planning not yet implemented');
    }
  }, [navigation, dateType]);

  /**
   * Handles date selection from calendar
   */
  const handleDateSelect = useCallback((date: string) => {
    setSelectedDate(date);
    logger.debug('Date selected', { date });
  }, []);

  // Haptic feedback and celebration on 100% completion
  useEffect(() => {
    if (overallProgress.percent === 100 && previousProgress < 100 && overallProgress.total > 0) {
      // Just reached 100% completion
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error) => {
        logger.debug('Haptic feedback failed', { error });
      });

      // Show celebration if enabled
      if (settings.celebrationEnabled) {
        setShowCelebration(true);
      }
    }
    setPreviousProgress(overallProgress.percent);
  }, [
    overallProgress.percent,
    overallProgress.total,
    previousProgress,
    settings.celebrationEnabled,
  ]);

  /**
   * Format selected date for display
   */
  const formatSelectedDate = useCallback((dateKey: string) => {
    const date = new Date(dateKey);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[date.getDay()];

    return `${year}년 ${month}월 ${day}일 (${dayName})`;
  }, []);

  /**
   * Renders progress summary section
   */
  const renderProgressSummary = () => {
    let title = '오늘의 진행률';
    if (dateType === 'past') {
      title = `${formatSelectedDate(selectedDate)}의 기록`;
    } else if (dateType === 'future') {
      title = `${formatSelectedDate(selectedDate)} 계획`;
    }

    return (
      <View style={styles.progressContainer}>
        <Text style={styles.progressTitle}>{title}</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressPercent}>{overallProgress.percent}%</Text>
          <Text style={styles.progressDetail}>
            {overallProgress.done} / {overallProgress.total} 완료
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBarFill, { width: `${overallProgress.percent}%` }]} />
        </View>
      </View>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => {
    if (dateType === 'past') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>기록이 없습니다</Text>
          <Text style={styles.emptySubtitle}>이 날짜에는 저장된 할 일 기록이 없습니다</Text>
        </View>
      );
    } else if (dateType === 'future') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🗓️</Text>
          <Text style={styles.emptyTitle}>미래 날짜입니다</Text>
          <Text style={styles.emptySubtitle}>
            + 버튼을 눌러 이 날짜의 할 일을 계획할 수 있습니다
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>오늘 할 일을 추가해보세요</Text>
        <Text style={styles.emptySubtitle}>
          + 버튼을 눌러 오늘 할 세부 항목을 선택할 수 있습니다
        </Text>
      </View>
    );
  };

  // Determine read-only mode
  const isReadOnly = dateType === 'past';

  // Show FAB button for today and future dates
  const showFAB = dateType === 'today' || dateType === 'future';

  // Empty state
  if (displayItems.length === 0) {
    return (
      <View style={styles.container}>
        <WeeklyCalendarNavigation
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          weekStartsOn={settings.weekStartsOn}
        />

        <ScrollView contentContainerStyle={styles.emptyScrollContent}>
          {renderEmptyState()}
        </ScrollView>

        {showFAB && (
          <TouchableOpacity
            style={styles.fab}
            onPress={handleSelectPress}
            accessible={true}
            accessibilityLabel={dateType === 'today' ? '오늘 할 일 선택' : '할 일 계획'}
            accessibilityRole="button"
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        )}

        <ConfettiCelebration
          visible={showCelebration}
          onComplete={() => setShowCelebration(false)}
          subtitle="오늘 할 일을 마쳤습니다"
        />
      </View>
    );
  }

  // Main content with items
  return (
    <View style={styles.container}>
      <WeeklyCalendarNavigation
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        weekStartsOn={settings.weekStartsOn}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {renderProgressSummary()}

        {/* Read-only indicator for past dates */}
        {isReadOnly && (
          <View style={styles.readOnlyBanner}>
            <Text style={styles.readOnlyText}>📖 읽기 전용 (과거 기록)</Text>
          </View>
        )}

        {/* Task Groups */}
        {itemsByTask.map((taskGroup) => {
          const task = taskGroup[0].task;
          return (
            <View key={task.id} style={styles.taskGroup}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <View style={styles.itemsContainer}>
                {taskGroup.map(({ item }) => (
                  <ChecklistItemView
                    key={item.id}
                    item={item}
                    onToggle={isReadOnly ? undefined : () => handleToggleItem(task.id, item.id)}
                    onDelete={
                      isReadOnly ? undefined : () => handleRemoveFromToday(task.id, item.id)
                    }
                    onUpdate={async () => ({ success: true })}
                  />
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {showFAB && (
        <TouchableOpacity
          style={styles.fab}
          onPress={handleSelectPress}
          accessible={true}
          accessibilityLabel={dateType === 'today' ? '오늘 할 일 선택' : '할 일 계획'}
          accessibilityRole="button"
        >
          <Text style={styles.fabIcon}>+</Text>
        </TouchableOpacity>
      )}

      <ConfettiCelebration
        visible={showCelebration}
        onComplete={() => setShowCelebration(false)}
        subtitle="오늘 할 일을 마쳤습니다"
      />
    </View>
  );
};

export default TodayScreen;

const styles = StyleSheet.create({
  /**
   * Main container
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
    flexDirection: 'column', // Explicit vertical layout
  },

  /**
   * Progress summary container - Modern Minimal Design
   * - Glass morphism effect
   * - More rounded corners
   * - Enhanced shadow
   * - Margin for floating effect
   */
  progressContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 24,
    borderRadius: 24,
    marginHorizontal: 24,
    marginTop: 8,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
    // Shadow for iOS
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    // Elevation for Android
    elevation: 4,
  },

  /**
   * Progress title - Modern Minimal Design
   * - Uppercase label style
   * - Letter spacing
   */
  progressTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  /**
   * Progress row (percentage and detail)
   */
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },

  /**
   * Progress percentage - Modern Minimal Design
   * - Large size (48px)
   * - Gradient text effect (approximated with primary)
   * - Bold weight
   */
  progressPercent: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 12,
    lineHeight: 48,
  },

  /**
   * Progress detail text
   */
  progressDetail: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  /**
   * Progress bar container - Modern Minimal Design
   * - Larger height (12px)
   * - Semi-transparent background
   * - More rounded corners (20px)
   */
  progressBarContainer: {
    height: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 20,
    overflow: 'hidden',
  },

  /**
   * Progress bar fill - Modern Minimal Design
   * - Gradient effect (approximated with primary)
   * - Glow shadow
   */
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 20,
  },

  /**
   * Scroll view
   */
  scrollView: {
    flex: 1,
  },

  /**
   * Scroll content
   * Only vertical padding - horizontal spacing handled by child components
   */
  scrollContent: {
    paddingVertical: spacing.lg,
  },

  /**
   * Empty scroll content (vertically centered)
   */
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center', // Center vertically in available space
    padding: spacing.lg,
  },

  /**
   * Task group container
   */
  taskGroup: {
    marginBottom: spacing.xl,
    marginHorizontal: 24, // Add horizontal margin for spacing from edges
  },

  /**
   * Task title - Modern Minimal Design
   * - Uppercase section header style
   * - Letter spacing
   * - Smaller font size
   */
  taskTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingLeft: 4,
  },

  /**
   * Items container - Modern Minimal Design
   * - Glass morphism effect
   * - More rounded corners (16px)
   * - Subtle border
   * - Enhanced shadow
   */
  itemsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    // Elevation for Android
    elevation: 2,
  },

  /**
   * Empty state container
   */
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },

  /**
   * Empty state icon
   */
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },

  /**
   * Empty state title
   */
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },

  /**
   * Empty state subtitle
   */
  emptySubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  /**
   * Read-only banner
   */
  readOnlyBanner: {
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },

  readOnlyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9800',
    textAlign: 'center',
  },

  /**
   * Floating Action Button (FAB) - Modern Minimal Design
   * - Larger size (64x64pt)
   * - Bottom position (116pt from bottom for tab bar)
   * - Enhanced shadow with primary glow
   */
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },

  /**
   * FAB icon (+ symbol)
   */
  fabIcon: {
    fontSize: 32,
    color: colors.surface,
    fontWeight: '300',
    lineHeight: 32,
  },
});
