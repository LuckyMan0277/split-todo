/**
 * Components Module Exports
 *
 * Central export point for all reusable React Native components.
 * Import components from this file for consistency and easier refactoring.
 *
 * @example
 * ```tsx
 * import { TaskCard, Button, ProgressBar } from '@/components';
 * ```
 */

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps } from './ProgressBar';

export { default as TaskCard } from './TaskCard';
export type { TaskCardProps } from './TaskCard';

export { default as ChecklistItemView } from './ChecklistItemView';
export type { ChecklistItemViewProps } from './ChecklistItemView';

export { default as AddItemInput } from './AddItemInput';
export type { AddItemInputProps } from './AddItemInput';

export { default as Button } from './Button';
export type { ButtonProps, ButtonVariant } from './Button';

export { default as ErrorBoundary } from './ErrorBoundary';

export { ConfettiCelebration } from './ConfettiCelebration';

export { WeeklyCalendarNavigation } from './WeeklyCalendarNavigation';

export {
  UnifiedCalendarView,
  WEEKLY_CALENDAR_HEIGHT,
  MONTHLY_CALENDAR_HEIGHT,
  calculateMonthlyCalendarHeight,
} from './UnifiedCalendarView';

// Re-export calendar utilities
export { calculateWeekCountForMonth } from './calendar/utils';
