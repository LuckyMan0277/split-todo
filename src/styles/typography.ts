/**
 * Typography Design Tokens
 *
 * Provides consistent text styles across the application.
 * All styles include fontSize, fontWeight, and lineHeight for optimal readability.
 *
 * @example
 * ```tsx
 * import { typography } from '@/styles/typography';
 *
 * <Text style={typography.h1}>Page Title</Text>
 * <Text style={typography.body}>Body text content</Text>
 * ```
 */

/**
 * Typography style interface
 */
export interface TypographyStyle {
  /** Font size in pixels */
  fontSize: number;
  /** Font weight (CSS font-weight values as strings for React Native) */
  fontWeight: '400' | '600' | '700';
  /** Line height in pixels for consistent vertical rhythm */
  lineHeight: number;
}

/**
 * Typography token type definition
 */
export interface Typography {
  /** Heading 1 - Used for page titles and main headings */
  h1: TypographyStyle;
  /** Heading 2 - Used for section titles */
  h2: TypographyStyle;
  /** Heading 3 - Used for subsection titles and card headings */
  h3: TypographyStyle;
  /** Body - Used for main content text */
  body: TypographyStyle;
  /** Caption - Used for supporting text, metadata, and small labels */
  caption: TypographyStyle;
}

/**
 * Application typography system
 *
 * Usage guidelines:
 * - Use `h1` for screen titles and main headings (TaskDetailScreen title)
 * - Use `h2` for section headers (e.g., "세부 단계" section)
 * - Use `h3` for card titles (TaskCard titles in list)
 * - Use `body` for main content, buttons, and input text
 * - Use `caption` for metadata, progress text, and supporting information
 *
 * Line height is set to 1.5x font size for optimal readability on mobile devices.
 */
export const typography: Typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700',  // Bold
    lineHeight: 36,     // 1.29x for large headings
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',  // Semibold
    lineHeight: 32,     // 1.33x
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',  // Semibold
    lineHeight: 28,     // 1.4x
  },
  body: {
    fontSize: 16,
    fontWeight: '400',  // Regular
    lineHeight: 24,     // 1.5x - optimal for readability
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',  // Regular
    lineHeight: 20,     // 1.43x
  },
} as const;
