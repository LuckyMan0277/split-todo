/**
 * Spacing Design Tokens
 *
 * Provides a consistent spacing scale for margins, padding, and gaps.
 * Based on an 4-pixel base unit for a systematic approach to layout.
 *
 * @example
 * ```tsx
 * import { spacing } from '@/styles/spacing';
 *
 * <View style={{ padding: spacing.md, marginBottom: spacing.lg }}>
 *   <Text>Content</Text>
 * </View>
 * ```
 */

/**
 * Spacing token type definition
 */
export interface Spacing {
  /** Extra small spacing - 4px */
  xs: number;
  /** Small spacing - 8px */
  sm: number;
  /** Medium spacing - 12px */
  md: number;
  /** Large spacing - 16px */
  lg: number;
  /** Extra large spacing - 20px */
  xl: number;
  /** Extra extra large spacing - 24px */
  xxl: number;
}

/**
 * Application spacing system
 *
 * Usage guidelines:
 * - Use `xs` (4px) for tight spacing, inner padding of small elements
 * - Use `sm` (8px) for small gaps between related elements
 * - Use `md` (12px) for moderate spacing between components
 * - Use `lg` (16px) for standard padding in cards, containers (most common)
 * - Use `xl` (20px) for larger gaps between sections
 * - Use `xxl` (24px) for maximum spacing, screen edges, major sections
 *
 * Scale: xs → sm → md → lg → xl → xxl
 *        4 → 8 → 12 → 16 → 20 → 24
 */
export const spacing: Spacing = {
  xs: 4, // Extra small - tight spacing
  sm: 8, // Small - compact spacing
  md: 12, // Medium - moderate spacing
  lg: 16, // Large - standard padding/margin
  xl: 20, // Extra large - section spacing
  xxl: 24, // Extra extra large - major spacing
} as const;
