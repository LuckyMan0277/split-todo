/**
 * Button Component
 *
 * A reusable button component with multiple variants and states.
 * Provides consistent styling and accessibility across the application.
 *
 * Accessibility:
 * - Full screen reader support
 * - Minimum 44x44pt touch target
 * - Clear state announcements (disabled, loading)
 * - Customizable accessibility labels
 *
 * Features:
 * - Three variants: primary, secondary, danger
 * - Loading state with spinner
 * - Disabled state with visual feedback
 * - Flexible sizing
 * - Full accessibility support
 *
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   onPress={() => handleSave()}
 *   accessibilityLabel="저장하기"
 * >
 *   저장
 * </Button>
 *
 * <Button
 *   variant="danger"
 *   onPress={() => handleDelete()}
 *   loading={isDeleting}
 * >
 *   삭제
 * </Button>
 * ```
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';

/**
 * Button variant types
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger';

/**
 * Button component props
 */
export interface ButtonProps {
  /**
   * Button text or content
   */
  children: React.ReactNode;

  /**
   * Callback when button is pressed
   */
  onPress: () => void;

  /**
   * Button variant (style)
   * @default "primary"
   */
  variant?: ButtonVariant;

  /**
   * Whether button is in loading state
   * Shows spinner and disables interaction
   * @default false
   */
  loading?: boolean;

  /**
   * Whether button is disabled
   * Prevents interaction and shows disabled style
   * @default false
   */
  disabled?: boolean;

  /**
   * Optional custom style for button container
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional custom style for button text
   */
  textStyle?: StyleProp<TextStyle>;

  /**
   * Accessibility label for screen readers
   * Defaults to button text if not provided
   */
  accessibilityLabel?: string;

  /**
   * Optional accessibility hint
   */
  accessibilityHint?: string;
}

/**
 * Button component implementation
 *
 * Provides a consistent button interface with:
 * - Multiple visual variants (primary, secondary, danger)
 * - Loading and disabled states
 * - Minimum 44x44pt touch target
 * - Full accessibility support
 */
const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  // Determine if button should be interactive
  const isDisabled = disabled || loading;

  // Get variant-specific styles
  const variantContainerStyle = getVariantContainerStyle(variant);
  const variantTextStyle = getVariantTextStyle(variant);

  // Get spinner color based on variant
  const spinnerColor = variant === 'secondary' ? colors.primary : colors.surface;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        variantContainerStyle,
        isDisabled && styles.containerDisabled,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <Text style={[styles.text, variantTextStyle, textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

/**
 * Gets container style for button variant
 */
function getVariantContainerStyle(variant: ButtonVariant): ViewStyle {
  switch (variant) {
    case 'primary':
      return styles.containerPrimary;
    case 'secondary':
      return styles.containerSecondary;
    case 'danger':
      return styles.containerDanger;
    default:
      return styles.containerPrimary;
  }
}

/**
 * Gets text style for button variant
 */
function getVariantTextStyle(variant: ButtonVariant): TextStyle {
  switch (variant) {
    case 'primary':
      return styles.textPrimary;
    case 'secondary':
      return styles.textSecondary;
    case 'danger':
      return styles.textDanger;
    default:
      return styles.textPrimary;
  }
}

export default Button;

const styles = StyleSheet.create({
  /**
   * Base container style
   * - Minimum 44x44pt touch target
   * - Rounded corners
   * - Centered content
   * - Comfortable padding
   */
  container: {
    minHeight: 44,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Primary variant container
   * - Blue background (brand color)
   * - No border
   */
  containerPrimary: {
    backgroundColor: colors.primary,
  },

  /**
   * Secondary variant container
   * - White background
   * - Primary color border
   */
  containerSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },

  /**
   * Danger variant container
   * - Red background (destructive action)
   * - No border
   */
  containerDanger: {
    backgroundColor: colors.danger,
  },

  /**
   * Disabled container state
   * - Reduced opacity for visual feedback
   */
  containerDisabled: {
    opacity: 0.5,
  },

  /**
   * Base text style
   * - Body typography (16px)
   * - Semibold weight for emphasis
   */
  text: {
    ...typography.body,
    fontWeight: '600',
  },

  /**
   * Primary variant text
   * - White color for contrast on blue background
   */
  textPrimary: {
    color: colors.surface,
  },

  /**
   * Secondary variant text
   * - Primary color to match border
   */
  textSecondary: {
    color: colors.primary,
  },

  /**
   * Danger variant text
   * - White color for contrast on red background
   */
  textDanger: {
    color: colors.surface,
  },
});
