/**
 * TaskDetailScreen Component
 *
 * Detail screen for viewing and editing a single task.
 * Features editable title, progress display, checklist items, and delete functionality.
 *
 * Accessibility:
 * - Full screen reader support
 * - 44x44pt minimum touch targets
 * - Clear navigation and actions
 *
 * Performance:
 * - FlatList optimization for checklist items
 * - useMemo for progress calculation
 * - Debounced title updates
 *
 * Features:
 * - Header with back and delete buttons
 * - Editable task title (TextInput, h1 style)
 * - Progress section with ProgressBar
 * - FlatList for checklist items
 * - AddItemInput for new items
 * - Haptic feedback on 100% completion
 * - ScrollView + KeyboardAvoidingView
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { debounce } from 'lodash';
import { useTaskStore } from '../store/taskStore';
import {
  ProgressBar,
  ChecklistItemView,
  AddItemInput,
} from '../components';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import { calcProgress } from '../utils/progress';
import { ChecklistItem } from '../types';

/**
 * TaskDetailScreen navigation props
 */
interface TaskDetailScreenProps {
  route: {
    params: {
      taskId: string;
    };
  };
  navigation: any;
}

/**
 * TaskDetailScreen component implementation
 */
const TaskDetailScreen: React.FC<TaskDetailScreenProps> = ({
  route,
  navigation,
}) => {
  const { taskId } = route.params;
  const {
    getTask,
    updateTaskTitle,
    deleteTask,
    addChecklistItem,
    toggleChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
  } = useTaskStore();

  const task = getTask(taskId);
  const [titleInput, setTitleInput] = useState(task?.title || '');
  const [previousProgress, setPreviousProgress] = useState(0);

  // Calculate progress
  const progress = useMemo(() => {
    if (!task) return { done: 0, total: 0, percent: 0 };
    return calcProgress(task);
  }, [task]);

  // Debounced title update
  const debouncedUpdateTitle = useCallback(
    debounce(async (newTitle: string) => {
      if (task && newTitle.trim() && newTitle !== task.title) {
        const result = await updateTaskTitle(taskId, newTitle);
        if (!result.success) {
          Alert.alert('저장 실패', result.error || '제목 저장에 실패했습니다');
        }
      }
    }, 500),
    [taskId, task]
  );

  // Handle title change
  const handleTitleChange = (newTitle: string) => {
    setTitleInput(newTitle);
    debouncedUpdateTitle(newTitle);
  };

  // Handle task deletion
  const handleDeleteTask = () => {
    Alert.alert(
      '할 일 삭제',
      '이 할 일을 삭제하시겠습니까?\n3초 내에 되돌릴 수 있습니다.',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteTask(taskId);
            navigation.goBack();
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Haptic feedback on 100% completion
  useEffect(() => {
    if (progress.percent === 100 && previousProgress < 100) {
      // Just reached 100% completion
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        (error) => {
          console.debug('Haptic feedback failed', error);
        }
      );
    }
    setPreviousProgress(progress.percent);
  }, [progress.percent]);

  // Update title input when task changes
  useEffect(() => {
    if (task) {
      setTitleInput(task.title);
    }
  }, [task?.title]);

  // Set up header buttons
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
          accessible={true}
          accessibilityLabel="뒤로 가기"
          accessibilityRole="button"
        >
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={handleDeleteTask}
          style={styles.headerButton}
          accessible={true}
          accessibilityLabel="할 일 삭제"
          accessibilityRole="button"
        >
          <Text style={[styles.headerButtonText, styles.deleteButtonText]}>
            삭제
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, taskId]);

  // Handle adding checklist item
  const handleAddItem = async (itemTitle: string) => {
    return await addChecklistItem(taskId, itemTitle);
  };

  // Render checklist item
  const renderChecklistItem = ({ item }: { item: ChecklistItem }) => (
    <ChecklistItemView
      item={item}
      onToggle={() => toggleChecklistItem(taskId, item.id)}
      onDelete={() => deleteChecklistItem(taskId, item.id)}
      onUpdate={async (newTitle: string) => {
        return await updateChecklistItem(taskId, item.id, newTitle);
      }}
    />
  );

  // Render empty checklist state
  const renderEmptyChecklist = () => (
    <View style={styles.emptyChecklistContainer}>
      <Text style={styles.emptyChecklistText}>
        세부 단계를 추가해보세요
      </Text>
    </View>
  );

  // If task not found, show error
  if (!task) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>할 일을 찾을 수 없습니다</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Task Title Section */}
        <View style={styles.titleSection}>
          <TextInput
            style={styles.titleInput}
            value={titleInput}
            onChangeText={handleTitleChange}
            placeholder="할 일 제목"
            placeholderTextColor={colors.textDisabled}
            multiline={true}
            maxLength={120}
            accessible={true}
            accessibilityLabel="할 일 제목"
          />
          <Text style={styles.titleCharCounter}>
            {titleInput.length}/120
          </Text>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressCard}>
            <Text style={styles.progressTitle}>진행률</Text>
            <ProgressBar progress={progress.percent} />
            <Text style={styles.progressText}>
              {progress.done}/{progress.total} 완료 ({progress.percent}%)
            </Text>
          </View>
        </View>

        {/* Checklist Section */}
        <View style={styles.checklistSection}>
          <Text style={styles.sectionTitle}>세부 단계</Text>

          {/* Checklist Items */}
          {task.items.length > 0 ? (
            <FlatList
              data={task.items}
              renderItem={renderChecklistItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              // Performance optimizations
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              updateCellsBatchingPeriod={50}
              windowSize={21}
              initialNumToRender={10}
            />
          ) : (
            renderEmptyChecklist()
          )}

          {/* Add Item Input */}
          <View style={styles.addItemContainer}>
            <AddItemInput
              placeholder="새 단계 추가"
              onAdd={handleAddItem}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default TaskDetailScreen;

const styles = StyleSheet.create({
  /**
   * Main container
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /**
   * ScrollView
   */
  scrollView: {
    flex: 1,
  },

  /**
   * ScrollView content container
   */
  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  /**
   * Header button
   */
  headerButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Header button text
   */
  headerButtonText: {
    ...typography.body,
    color: colors.primary,
    fontSize: 18,
    fontWeight: '600',
  },

  /**
   * Delete button text (red color)
   */
  deleteButtonText: {
    color: colors.danger,
  },

  /**
   * Title section
   */
  titleSection: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  /**
   * Title input (h1 style)
   */
  titleInput: {
    ...typography.h1,
    color: colors.textPrimary,
    padding: 0,
    margin: 0,
    minHeight: 44,
  },

  /**
   * Title character counter
   */
  titleCharCounter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  /**
   * Progress section
   */
  progressSection: {
    padding: spacing.lg,
  },

  /**
   * Progress card
   */
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 2,
  },

  /**
   * Progress title
   */
  progressTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  /**
   * Progress text
   */
  progressText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  /**
   * Checklist section
   */
  checklistSection: {
    padding: spacing.lg,
  },

  /**
   * Section title
   */
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },

  /**
   * Empty checklist container
   */
  emptyChecklistContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },

  /**
   * Empty checklist text
   */
  emptyChecklistText: {
    ...typography.body,
    color: colors.textSecondary,
  },

  /**
   * Add item container
   */
  addItemContainer: {
    marginTop: spacing.lg,
  },

  /**
   * Error container (when task not found)
   */
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  /**
   * Error text
   */
  errorText: {
    ...typography.h2,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
