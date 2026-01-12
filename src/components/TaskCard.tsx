/**
 * TaskCard Component
 *
 * A card component that displays a task with its progress.
 * Shows task title, progress bar, and completion statistics.
 *
 * Accessibility:
 * - Full screen reader support with descriptive labels
 * - Minimum 44x44pt touch target
 * - Clear accessibility hints for interaction
 *
 * Performance:
 * - Memoized to prevent unnecessary re-renders
 * - Progress calculation cached with useMemo
 *
 * @example
 * ```tsx
 * <TaskCard
 *   task={myTask}
 *   onPress={() => navigation.navigate('TaskDetail', { taskId: myTask.id })}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Task } from '../types';
import { calcProgress } from '../utils/progress';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import { ProgressBar } from './ProgressBar';

/**
 * TaskCard component props
 */
export interface TaskCardProps {
  /**
   * Task object to display
   */
  task: Task;

  /**
   * Callback when card is pressed
   */
  onPress: () => void;

  /**
   * Optional custom style for the card container
   */
  style?: StyleProp<ViewStyle>;
}

/**
 * TaskCard component implementation
 *
 * Features:
 * - Displays task title with h3 typography
 * - Shows progress bar with completion percentage
 * - Displays completion text (n/m 완료, percent%)
 * - Touchable with proper accessibility support
 * - Optimized with React.memo and useMemo
 */
const TaskCard: React.FC<TaskCardProps> = ({ task, onPress, style }) => {
  // Calculate progress with useMemo to avoid recalculation on every render
  const progress = useMemo(() => calcProgress(task), [task]);

  // Generate accessibility label for screen readers
  const accessibilityLabel = `${task.title}, ${progress.done}개 중 ${progress.total}개 완료, ${progress.percent}퍼센트`;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={onPress}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="탭하여 세부 단계 보기"
      accessibilityRole="button"
    >
      {/* Task Title */}
      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
        {task.title}
      </Text>

      {/* Progress Section */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarWrapper}>
          <ProgressBar progress={progress.percent} />
        </View>
        <Text style={styles.progressPercent}>{progress.percent}%</Text>
      </View>

      {/* Progress Detail Text */}
      <Text style={styles.progressText}>
        {progress.done}/{progress.total} 완료
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Memoized TaskCard to prevent unnecessary re-renders
 * Only re-renders when task or onPress changes
 */
export default React.memo(TaskCard, (prevProps, nextProps) => {
  // Compare task by reference and key properties
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.title === nextProps.task.title &&
    prevProps.task.items.length === nextProps.task.items.length &&
    prevProps.task.items.filter((item) => item.done).length ===
      nextProps.task.items.filter((item) => item.done).length &&
    prevProps.onPress === nextProps.onPress
  );
});

const styles = StyleSheet.create({
  /**
   * Card container - Modern Minimal Design
   * - Pure white surface background
   * - Larger border radius for softer feel (20px)
   * - More padding for breathing room
   * - Subtle shadow for depth
   * - Border for definition
   */
  container: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    // Elevation for Android
    elevation: 2,
    minHeight: 44,
  },

  /**
   * Task title text
   * - Uses h3 typography (17px, semibold)
   * - Primary text color for maximum contrast
   * - Max 2 lines with ellipsis
   */
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    fontWeight: '600',
  },

  /**
   * Progress container - horizontal layout
   */
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  /**
   * Progress bar wrapper - takes remaining space
   */
  progressBarWrapper: {
    flex: 1,
  },

  /**
   * Progress percent text
   * - Bold percentage display
   * - Primary gradient color
   */
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  /**
   * Progress detail text (n/m 완료)
   * - Uses caption typography (13px, medium)
   * - Secondary text color for hierarchy
   */
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
