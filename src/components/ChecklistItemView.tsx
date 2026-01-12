/**
 * ChecklistItemView Component
 *
 * Displays a single checklist item with checkbox, title, and delete button.
 * Supports inline editing via long press and visual feedback for completion.
 *
 * Accessibility:
 * - Full screen reader support
 * - 44x44pt minimum touch targets
 * - Clear state announcements (completed/not completed)
 * - Descriptive hints for interactions
 *
 * Features:
 * - Checkbox toggle (24x24 visual, 44x44 touch)
 * - Long press (500ms) to enter edit mode
 * - Inline editing with TextInput
 * - Delete button with confirmation
 * - Strikethrough style when completed
 *
 * @example
 * ```tsx
 * <ChecklistItemView
 *   item={myItem}
 *   onToggle={() => handleToggle(myItem.id)}
 *   onDelete={() => handleDelete(myItem.id)}
 *   onUpdate={async (newTitle) => {
 *     await updateItem(myItem.id, newTitle);
 *     return { success: true };
 *   }}
 * />
 * ```
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { ChecklistItem } from '../types';
import { validateTitle, normalizeTitle } from '../utils/validation';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';

/**
 * ChecklistItemView component props
 */
export interface ChecklistItemViewProps {
  /**
   * Checklist item to display
   */
  item: ChecklistItem;

  /**
   * Callback when checkbox is toggled
   * If undefined, the checkbox will be read-only (disabled)
   */
  onToggle?: () => void;

  /**
   * Callback when item is deleted
   * If undefined, the delete button will be hidden
   */
  onDelete?: () => void;

  /**
   * Callback when item title is updated
   * @param newTitle - The updated title
   * @returns Result object with success status and optional error message
   */
  onUpdate: (newTitle: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * ChecklistItemView component implementation
 *
 * Displays a checklist item with:
 * - Checkbox (24x24 visual, 44x44 touch area with hitSlop)
 * - Item title (strikethrough when done)
 * - Long press to edit (500ms delay)
 * - Delete button (44x44 touch area)
 */
const ChecklistItemView: React.FC<ChecklistItemViewProps> = ({
  item,
  onToggle,
  onDelete,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.title);
  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * Handles long press to enter edit mode
   */
  const handleLongPress = () => {
    setIsEditing(true);
    setEditText(item.title);
  };

  /**
   * Handles saving edited title
   */
  const handleSaveEdit = async () => {
    const normalized = normalizeTitle(editText);
    const validation = validateTitle(normalized);

    if (!validation.valid) {
      Alert.alert('입력 오류', validation.error || '올바른 제목을 입력해주세요');
      return;
    }

    // Don't update if text hasn't changed
    if (normalized === item.title) {
      setIsEditing(false);
      return;
    }

    setIsUpdating(true);
    const result = await onUpdate(normalized);
    setIsUpdating(false);

    if (result.success) {
      setIsEditing(false);
    } else {
      Alert.alert('저장 실패', result.error || '제목 저장에 실패했습니다');
    }
  };

  /**
   * Handles canceling edit mode
   */
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditText(item.title);
  };

  /**
   * Handles delete with confirmation dialog
   */
  const handleDelete = () => {
    Alert.alert(
      '항목 삭제',
      '이 항목을 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: onDelete,
        },
      ],
      { cancelable: true }
    );
  };

  // Accessibility label for checkbox
  const checkboxLabel = `${item.title}, ${item.done ? '완료됨' : '미완료'}`;

  // Read-only mode when onToggle is undefined
  const isReadOnly = !onToggle;

  // Hide delete button when onDelete is undefined
  const canDelete = !!onDelete;

  return (
    <View style={[styles.container, isReadOnly && styles.containerReadOnly]}>
      {/* Checkbox */}
      <TouchableOpacity
        onPress={onToggle}
        style={styles.checkboxContainer}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessible={true}
        accessibilityLabel={checkboxLabel}
        accessibilityHint={isReadOnly ? '읽기 전용' : '탭하여 완료 상태 전환'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done, disabled: isReadOnly }}
        disabled={isReadOnly}
      >
        <View
          style={[
            styles.checkbox,
            item.done && styles.checkboxChecked,
            isReadOnly && styles.checkboxReadOnly,
          ]}
        >
          {item.done && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>

      {/* Item Title or Edit Input */}
      <View style={styles.contentContainer}>
        {isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              onBlur={handleCancelEdit}
              onSubmitEditing={handleSaveEdit}
              autoFocus={true}
              maxLength={120}
              returnKeyType="done"
              editable={!isUpdating}
              accessible={true}
              accessibilityLabel="항목 제목 편집"
            />
          </View>
        ) : (
          <TouchableOpacity
            onPress={onToggle}
            onLongPress={isReadOnly ? undefined : handleLongPress}
            delayLongPress={500}
            style={styles.titleContainer}
            accessible={true}
            accessibilityLabel={checkboxLabel}
            accessibilityHint={isReadOnly ? '읽기 전용' : '길게 눌러서 편집'}
            disabled={isReadOnly}
          >
            <Text style={[styles.title, item.done && styles.titleCompleted]} numberOfLines={2}>
              {item.title}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Delete Button (hidden when onDelete is undefined) */}
      {canDelete && (
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Extend touch area to 44x44
          accessible={true}
          accessibilityLabel="항목 삭제"
          accessibilityRole="button"
        >
          <Text style={styles.deleteButtonText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ChecklistItemView;

const styles = StyleSheet.create({
  /**
   * Container for the entire item
   * - Horizontal layout with space between
   * - Vertical alignment centered
   * - Minimum height ensures 44pt touch target
   */
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 44,
  },

  /**
   * Read-only container style
   */
  containerReadOnly: {
    opacity: 0.7,
  },

  /**
   * Checkbox container
   * - 24x24 visual size
   * - Uses hitSlop to extend touch area to 44x44
   */
  checkboxContainer: {
    marginRight: spacing.md,
  },

  /**
   * Checkbox visual - Modern Minimal Design
   * - 24x24 circular shape
   * - Light border for unchecked state
   * - Smooth corners
   */
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d4d4d8',
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Checked checkbox state
   * - Gradient green background
   */
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },

  /**
   * Read-only checkbox style
   */
  checkboxReadOnly: {
    opacity: 0.5,
  },

  /**
   * Checkmark symbol
   * - White color for contrast
   * - Smaller size for circular checkbox
   */
  checkmark: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: '700',
  },

  /**
   * Content container
   * - Flexible to take remaining space
   */
  contentContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },

  /**
   * Title container
   * - Tappable area for title
   */
  titleContainer: {
    flex: 1,
  },

  /**
   * Item title text - Modern Minimal Design
   * - Body typography (15px, regular)
   * - Primary text color
   */
  title: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },

  /**
   * Completed item title style
   * - Strikethrough decoration
   * - Lighter gray for de-emphasis
   */
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textDisabled,
  },

  /**
   * Edit mode container
   */
  editContainer: {
    flex: 1,
  },

  /**
   * Edit mode text input - Modern Minimal Design
   * - Body typography
   * - Lighter border with primary focus
   * - More rounded corners
   */
  editInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },

  /**
   * Delete button
   * - 24x24 visual size
   * - Uses hitSlop to extend touch area to 44x44
   */
  deleteButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Delete button text (× symbol)
   * - Large size for visibility
   * - Danger color for destructive action
   */
  deleteButtonText: {
    fontSize: 20,
    color: colors.danger,
    fontWeight: '600',
  },
});
