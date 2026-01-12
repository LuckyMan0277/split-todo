/**
 * TaskListScreen Component
 *
 * Main screen displaying all tasks in a scrollable list.
 * Features search, empty state, FAB for adding tasks, and task add modal.
 *
 * Accessibility:
 * - Full screen reader support
 * - 44x44pt minimum touch targets
 * - Clear labels and hints
 *
 * Performance:
 * - FlatList with optimization props
 * - useMemo for filtered tasks
 * - React.memo for TaskCard components
 *
 * Features:
 * - Task list with TaskCard components
 * - Search (shown when 20+ tasks)
 * - Empty state with example loading
 * - FAB (+) button for adding tasks
 * - Task add modal
 * - Navigation to TaskDetailScreen
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  StyleSheet,
  Alert,
  Platform,
  Keyboard,
  Animated,
} from 'react-native';
import { useTaskStore } from '../store/taskStore';
import { TaskCard, Button } from '../components';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import { Task } from '../types';
import { EXAMPLE_TASKS } from '../data/examples';

/**
 * TaskListScreen navigation props
 */
interface TaskListScreenProps {
  navigation: any;
}

/**
 * TaskListScreen component implementation
 */
const TaskListScreen: React.FC<TaskListScreenProps> = ({ navigation }) => {
  const { tasks, addTask } = useTaskStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [keyboardHeight] = useState(new Animated.Value(0));

  /**
   * Keyboard listeners for custom animation
   */
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: 80, // 키보드 올라오는 속도 (밀리초)
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: 200, // 키보드 내려가는 속도 (밀리초)
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardHeight]);

  // Filter tasks based on search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) {
      return tasks;
    }

    const query = searchQuery.toLowerCase();
    return tasks.filter((task) => task.title.toLowerCase().includes(query));
  }, [tasks, searchQuery]);

  /**
   * Handles task card press - navigate to detail screen
   */
  const handleTaskPress = (taskId: string) => {
    navigation.navigate('TaskDetail', { taskId });
  };

  /**
   * Handles adding a new task
   */
  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('입력 오류', '할 일 제목을 입력해주세요');
      return;
    }

    setIsAdding(true);
    const result = await addTask(newTaskTitle);
    setIsAdding(false);

    if (result.success) {
      setNewTaskTitle('');
      setIsAddModalVisible(false);
    } else {
      Alert.alert('추가 실패', result.error || '할 일 추가에 실패했습니다');
    }
  };

  /**
   * Handles loading example tasks with full checklist items
   */
  const handleLoadExamples = () => {
    // Load example tasks from examples.ts
    // Note: We directly add the tasks to the store
    // This bypasses the normal addTask flow to preserve the complete example data
    useTaskStore.setState((state) => ({
      tasks: [...state.tasks, ...EXAMPLE_TASKS],
    }));
  };

  /**
   * Renders a single task card
   */
  const renderTask = ({ item }: { item: Task }) => (
    <TaskCard task={item} onPress={() => handleTaskPress(item.id)} style={styles.taskCard} />
  );

  /**
   * Renders empty state when no tasks exist
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>할 일을 추가해보세요!</Text>
      <Text style={styles.emptySubtitle}>+ 버튼을 눌러 새로운 할 일을 만들 수 있습니다</Text>
      <Button
        variant="secondary"
        onPress={handleLoadExamples}
        style={styles.exampleButton}
        accessibilityLabel="예시 보기"
        accessibilityHint="예시 할 일 3개를 추가합니다"
      >
        예시 보기
      </Button>
    </View>
  );

  /**
   * Renders empty search results
   */
  const renderEmptySearch = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>검색 결과가 없습니다</Text>
      <Text style={styles.emptySubtitle}>다른 키워드로 검색해보세요</Text>
    </View>
  );

  // Show search bar only when there are 20+ tasks
  const showSearch = tasks.length >= 20;

  return (
    <View style={styles.container}>
      {/* Search Bar (shown when 20+ tasks) */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="할 일 검색"
            placeholderTextColor={colors.textDisabled}
            returnKeyType="search"
            accessible={true}
            accessibilityLabel="할 일 검색"
            accessibilityHint="검색어를 입력하여 할 일을 찾으세요"
          />
        </View>
      )}

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          filteredTasks.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={searchQuery.trim() ? renderEmptySearch() : renderEmptyState()}
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={21}
        initialNumToRender={10}
        // For fixed-height items, getItemLayout can be implemented
        // getItemLayout={(data, index) => ({
        //   length: ITEM_HEIGHT,
        //   offset: ITEM_HEIGHT * index,
        //   index,
        // })}
      />

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsAddModalVisible(true)}
        accessible={true}
        accessibilityLabel="새 할 일 추가"
        accessibilityRole="button"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Add Task Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setIsAddModalVisible(false);
            setNewTaskTitle('');
          }}
        >
          <View style={styles.modalContainer}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <Animated.View style={[styles.modalContent, { marginBottom: keyboardHeight }]}>
                {/* Modal Header */}
                <Text style={styles.modalTitle}>새 할 일 추가</Text>

                {/* Title Input */}
                <TextInput
                  style={styles.modalInput}
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  placeholder="할 일 제목"
                  placeholderTextColor={colors.textDisabled}
                  maxLength={120}
                  returnKeyType="done"
                  onSubmitEditing={handleAddTask}
                  autoFocus={true}
                  editable={!isAdding}
                  accessible={true}
                  accessibilityLabel="할 일 제목 입력"
                />

                {/* Character Counter */}
                <Text style={styles.charCounter}>{newTaskTitle.length}/120</Text>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setIsAddModalVisible(false);
                      setNewTaskTitle('');
                    }}
                    disabled={isAdding}
                    style={styles.modalButton}
                    accessibilityLabel="취소"
                  >
                    취소
                  </Button>

                  <Button
                    variant="primary"
                    onPress={handleAddTask}
                    loading={isAdding}
                    disabled={isAdding || !newTaskTitle.trim()}
                    style={styles.modalButton}
                    accessibilityLabel="추가"
                  >
                    추가
                  </Button>
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default TaskListScreen;

const styles = StyleSheet.create({
  /**
   * Main container
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /**
   * Search container
   */
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  /**
   * Search input field - Modern Minimal Design
   * - More rounded corners (12px)
   * - Lighter background
   */
  searchInput: {
    ...typography.body,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
    color: colors.textPrimary,
  },

  /**
   * List content container
   */
  listContent: {
    padding: spacing.lg,
  },

  /**
   * List content when empty (centered)
   */
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /**
   * Individual task card margin
   */
  taskCard: {
    marginBottom: spacing.md,
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
    marginBottom: spacing.xl,
    textAlign: 'center',
  },

  /**
   * Example button in empty state
   */
  exampleButton: {
    minWidth: 120,
  },

  /**
   * Floating Action Button (FAB) - Modern Minimal Design
   * - 64x64pt larger size
   * - Bottom-right corner (24pt from edges)
   * - Circular shape
   * - Gradient primary color
   * - Enhanced shadow with primary color glow
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
    // Shadow for iOS with primary color
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    // Elevation for Android
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

  /**
   * Modal container
   */
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },

  /**
   * Modal content card - Modern Minimal Design
   * - More rounded corners (24px)
   * - Increased padding for breathing room
   */
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xxl,
    paddingBottom: Platform.OS === 'ios' ? spacing.xxl + 20 : spacing.xxl,
  },

  /**
   * Modal title
   */
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  /**
   * Modal input field - Modern Minimal Design
   * - More rounded corners (12px)
   */
  modalInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    minHeight: 44,
    marginBottom: spacing.xs,
  },

  /**
   * Character counter
   */
  charCounter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.lg,
  },

  /**
   * Modal action buttons container
   */
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },

  /**
   * Individual modal button
   */
  modalButton: {
    flex: 1,
  },
});
