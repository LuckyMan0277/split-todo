/**
 * TodaySelectScreen Component
 *
 * Screen for selecting which checklist items should be marked as "today's tasks".
 * Displays all tasks with their items as checkboxes for selection.
 *
 * Features:
 * - Checkbox list of all checklist items grouped by task
 * - Toggle selection with haptic feedback
 * - Header with "Done" button
 * - Shows task titles as section headers
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTaskStore } from '../store/taskStore';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import { Task } from '../types';
import { getTodayKey } from '../services/dailyRecords';

/**
 * TodaySelectScreen navigation props
 */
interface TodaySelectScreenProps {
  navigation: any;
}

/**
 * TodaySelectScreen component implementation
 */
const TodaySelectScreen: React.FC<TodaySelectScreenProps> = ({ navigation }) => {
  const { tasks, toggleChecklistItemToday } = useTaskStore();

  // Get today's date key
  const todayKey = useMemo(() => getTodayKey(), []);

  // Filter tasks that have at least one item
  const tasksWithItems = tasks.filter((task) => task.items.length > 0);

  /**
   * Handles checkbox toggle
   */
  const handleToggle = (taskId: string, itemId: string) => {
    toggleChecklistItemToday(taskId, itemId);
  };

  /**
   * Renders a task section with its items
   */
  const renderTask = (task: Task) => {
    return (
      <View key={task.id} style={styles.taskSection}>
        {/* Task Title */}
        <Text style={styles.taskTitle}>{task.title}</Text>

        {/* Items */}
        <View style={styles.itemsContainer}>
          {task.items.map((item) => {
            const scheduledDates = item.scheduledDates || [];
            const isSelected = scheduledDates.includes(todayKey);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.itemRow}
                onPress={() => handleToggle(task.id, item.id)}
                accessible={true}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={item.title}
              >
                {/* Checkbox */}
                <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>

                {/* Item Title */}
                <Text
                  style={[styles.itemTitle, item.done && styles.itemTitleDone]}
                  numberOfLines={2}
                >
                  {item.title}
                </Text>

                {/* Done Badge */}
                {item.done && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>완료</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>세부 항목이 없습니다</Text>
      <Text style={styles.emptySubtitle}>
        전체 탭에서 할 일을 추가하고 세부 항목을 만들어주세요
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Content */}
      {tasksWithItems.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScrollContent}>
          {renderEmptyState()}
        </ScrollView>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {tasksWithItems.map((task) => renderTask(task))}
        </ScrollView>
      )}
    </View>
  );
};

export default TodaySelectScreen;

const styles = StyleSheet.create({
  /**
   * Main container
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /**
   * Scroll view
   */
  scrollView: {
    flex: 1,
  },

  /**
   * Scroll content
   */
  scrollContent: {
    padding: spacing.lg,
  },

  /**
   * Empty scroll content (centered)
   */
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },

  /**
   * Task section
   */
  taskSection: {
    marginBottom: spacing.xl,
  },

  /**
   * Task title - Modern Minimal Design
   * - Uppercase section header style
   * - Letter spacing
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
   */
  itemsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    overflow: 'hidden',
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
   * Item row
   */
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  /**
   * Checkbox - Modern Minimal Design
   * - Circular shape
   * - Light border for unchecked state
   */
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d4d4d8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },

  /**
   * Checkbox when checked
   */
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  /**
   * Checkmark symbol
   */
  checkmark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: 'bold',
  },

  /**
   * Item title
   */
  itemTitle: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },

  /**
   * Item title when done
   */
  itemTitleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },

  /**
   * Done badge
   */
  doneBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: 4,
    flexShrink: 0,
  },

  /**
   * Done badge text
   */
  doneBadgeText: {
    ...typography.caption,
    color: colors.surface,
    fontSize: 10,
    fontWeight: '600',
  },

  /**
   * Empty state container
   */
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
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
});
