/**
 * Design Tokens - Central Export
 *
 * This file provides a single point of import for all design tokens.
 *
 * @example
 * ```tsx
 * import { colors, typography, spacing } from '@/styles';
 *
 * <View style={{ backgroundColor: colors.surface, padding: spacing.lg }}>
 *   <Text style={{ ...typography.h1, color: colors.textPrimary }}>
 *     Hello World
 *   </Text>
 * </View>
 * ```
 */

export * from './colors';
export * from './typography';
export * from './spacing';
