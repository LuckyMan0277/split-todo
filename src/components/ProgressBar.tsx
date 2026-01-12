/**
 * ProgressBar Component
 *
 * A visual progress indicator that displays task completion percentage.
 * Changes color from primary (blue) to success (green) when 100% complete.
 *
 * Accessibility:
 * - Includes descriptive accessibilityLabel with percentage
 * - Screen readers announce progress as "{percent}% 완료"
 *
 * @example
 * ```tsx
 * <ProgressBar progress={60} />
 * // Displays: 60% filled blue bar
 *
 * <ProgressBar progress={100} />
 * // Displays: 100% filled green bar
 * ```
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';

/**
 * ProgressBar component props
 */
export interface ProgressBarProps {
  /**
   * Progress value between 0-100
   * @example 60 for 60% completion
   */
  progress: number;
}

/**
 * ProgressBar component
 *
 * Displays a horizontal progress bar with:
 * - Height: 10-12pt (accessibility-friendly)
 * - Background: colors.border (gray)
 * - Fill: colors.primary (blue) when < 100%, colors.success (green) when 100%
 * - Border radius: 6pt for smooth corners
 * - Accessible with screen reader label
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  // Clamp progress between 0 and 100
  const clampedProgress = Math.max(0, Math.min(100, progress));

  // Determine fill color: green if 100%, blue otherwise
  const fillColor = clampedProgress === 100 ? colors.success : colors.primary;

  // Accessibility label for screen readers
  const accessibilityLabel = `${clampedProgress}% 완료`;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
    >
      {/* Progress fill - animated width based on percentage */}
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress}%`,
            backgroundColor: fillColor,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  /**
   * Container for the progress bar - Modern Design
   * - Light background with subtle opacity
   * - Slightly smaller height (6pt)
   * - Larger border radius for softer look
   */
  container: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
  },

  /**
   * Fill bar that represents progress
   * - Dynamic width based on progress value
   * - Dynamic color (primary or success)
   * - Smooth rounded corners
   */
  fill: {
    height: '100%',
    borderRadius: 10,
  },
});
