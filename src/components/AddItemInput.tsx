/**
 * AddItemInput Component
 *
 * An input component for adding new tasks or checklist items.
 * Features text input with character counter and validation.
 *
 * Accessibility:
 * - Screen reader support with labels and hints
 * - 44x44pt minimum touch target for button
 * - Keyboard-friendly with return key handling
 *
 * Features:
 * - Text input with 120 character limit
 * - Real-time character counter
 * - Add button with loading state
 * - Input validation using normalizeTitle
 * - Error handling with alerts
 * - Auto-clear on success
 *
 * @example
 * ```tsx
 * <AddItemInput
 *   placeholder="새 항목 추가"
 *   onAdd={async (title) => {
 *     await addChecklistItem(taskId, title);
 *     return { success: true };
 *   }}
 * />
 * ```
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { validateTitle, normalizeTitle } from '../utils/validation';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';

/**
 * AddItemInput component props
 */
export interface AddItemInputProps {
  /**
   * Callback when user wants to add a new item
   * @param title - The normalized title entered by user
   * @returns Result object with success status and optional error message
   */
  onAdd: (title: string) => Promise<{ success: boolean; error?: string }>;

  /**
   * Optional placeholder text for the input
   * @default "새 항목 추가"
   */
  placeholder?: string;
}

/**
 * AddItemInput component implementation
 *
 * Provides:
 * - TextInput with maxLength validation
 * - Character counter (current/120)
 * - Add button (44x44pt touch area)
 * - Loading state with spinner
 * - Input validation
 * - Error handling
 */
const AddItemInput: React.FC<AddItemInputProps> = ({
  onAdd,
  placeholder = '새 항목 추가',
}) => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handles adding a new item
   */
  const handleAdd = async () => {
    // Normalize and validate input
    const normalized = normalizeTitle(inputText);
    const validation = validateTitle(normalized);

    if (!validation.valid) {
      Alert.alert('입력 오류', validation.error || '올바른 제목을 입력해주세요');
      return;
    }

    // Call onAdd with normalized title
    setIsLoading(true);
    const result = await onAdd(normalized);
    setIsLoading(false);

    if (result.success) {
      // Clear input on success
      setInputText('');
    } else {
      // Show error alert on failure
      Alert.alert('추가 실패', result.error || '항목 추가에 실패했습니다');
    }
  };

  // Character count for display
  const charCount = inputText.length;
  const maxChars = 120;

  return (
    <View style={styles.container}>
      {/* Text Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          maxLength={maxChars}
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          editable={!isLoading}
          accessible={true}
          accessibilityLabel={placeholder}
          accessibilityHint="새 항목의 제목을 입력하고 추가 버튼을 누르세요"
        />

        {/* Character Counter */}
        <Text style={styles.charCounter}>
          {charCount}/{maxChars}
        </Text>
      </View>

      {/* Add Button */}
      <TouchableOpacity
        onPress={handleAdd}
        style={[styles.addButton, isLoading && styles.addButtonDisabled]}
        disabled={isLoading || inputText.trim().length === 0}
        accessible={true}
        accessibilityLabel="항목 추가"
        accessibilityRole="button"
        accessibilityState={{ disabled: isLoading || inputText.trim().length === 0 }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.surface} />
        ) : (
          <Text style={styles.addButtonText}>+</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default AddItemInput;

const styles = StyleSheet.create({
  /**
   * Container for the entire component
   * - Horizontal layout
   * - Aligned items
   */
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },

  /**
   * Input container
   * - Flexible to take remaining space
   * - Includes TextInput and character counter
   */
  inputContainer: {
    flex: 1,
  },

  /**
   * Text input field
   * - Body typography (16px)
   * - Border with rounded corners
   * - Padding for comfort
   * - Background color for visibility
   * - Minimum height to ensure comfortable input
   */
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    minHeight: 44, // Ensure minimum touch target
  },

  /**
   * Character counter text
   * - Caption typography (14px)
   * - Secondary color
   * - Right-aligned
   * - Small top margin for spacing
   */
  charCounter: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },

  /**
   * Add button
   * - 44x44pt minimum touch target
   * - Primary color background
   * - Rounded square shape
   * - Centered content
   */
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Disabled add button state
   * - Reduced opacity for visual feedback
   */
  addButtonDisabled: {
    opacity: 0.5,
  },

  /**
   * Add button text (+ symbol)
   * - Large size for visibility
   * - White color for contrast
   * - Bold weight
   */
  addButtonText: {
    fontSize: 24,
    color: colors.surface,
    fontWeight: '700',
  },
});
