/**
 * ErrorBoundary Component
 *
 * A React error boundary that catches JavaScript errors in child components,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 *
 * Features:
 * - Catches errors in child component tree
 * - Logs errors to console (can be extended to send to error tracking service)
 * - Displays user-friendly error UI
 * - Provides retry button to attempt recovery
 * - Prevents app crashes from unhandled errors
 *
 * Usage:
 * Wrap any part of your component tree that might throw errors:
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <TaskDetailScreen />
 * </ErrorBoundary>
 * ```
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';
import Button from './Button';

/**
 * ErrorBoundary component props
 */
interface ErrorBoundaryProps {
  /**
   * Child components to wrap and protect from errors
   */
  children: ReactNode;

  /**
   * Optional fallback component to display instead of default error UI
   */
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
}

/**
 * ErrorBoundary component state
 */
interface ErrorBoundaryState {
  /**
   * Whether an error has been caught
   */
  hasError: boolean;

  /**
   * The error that was caught (if any)
   */
  error: Error | null;

  /**
   * React error info with component stack trace
   */
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary component implementation
 *
 * A class component that implements React's error boundary lifecycle methods:
 * - getDerivedStateFromError: Updates state when error is caught
 * - componentDidCatch: Logs error details
 *
 * When an error occurs:
 * 1. Error is caught by getDerivedStateFromError
 * 2. State is updated to show error UI
 * 3. componentDidCatch logs the error
 * 4. User sees fallback UI with retry button
 * 5. Retry button clears error state and re-renders children
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static lifecycle method called when an error is thrown
   * Updates state to trigger error UI rendering
   *
   * @param error - The error that was thrown
   * @returns New state with error flag set
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so next render shows fallback UI
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called after an error is caught
   * Used for error logging and reporting
   *
   * @param error - The error that was thrown
   * @param errorInfo - React error info with component stack
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Update state with error info for display
    this.setState({
      errorInfo,
    });

    // TODO: Send error to error tracking service (e.g., Sentry)
    // Example:
    // Sentry.captureException(error, {
    //   contexts: {
    //     react: {
    //       componentStack: errorInfo.componentStack,
    //     },
    //   },
    // });
  }

  /**
   * Handles retry button press
   * Clears error state and attempts to re-render children
   */
  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    // If there's an error, show fallback UI
    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            {/* Error Icon */}
            <Text style={styles.icon}>⚠️</Text>

            {/* Error Title */}
            <Text style={styles.title}>앗, 문제가 발생했습니다</Text>

            {/* Error Message */}
            <Text style={styles.message}>
              예상치 못한 오류가 발생했습니다.{'\n'}
              다시 시도하거나 앱을 재시작해보세요.
            </Text>

            {/* Error Details (for development) */}
            {__DEV__ && error && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>오류 세부 정보:</Text>
                <Text style={styles.detailsText}>{error.toString()}</Text>
                {errorInfo && (
                  <Text style={styles.detailsText} numberOfLines={5}>
                    {errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            {/* Retry Button */}
            <Button
              variant="primary"
              onPress={this.handleRetry}
              accessibilityLabel="다시 시도"
              accessibilityHint="앱을 다시 로드합니다"
              style={styles.retryButton}
            >
              다시 시도
            </Button>
          </View>
        </View>
      );
    }

    // No error, render children normally
    return children;
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  /**
   * Main container
   * - Full screen
   * - Centered content
   * - Background color
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },

  /**
   * Content container
   * - Max width for readability
   * - Centered text alignment
   */
  content: {
    maxWidth: 400,
    alignItems: 'center',
  },

  /**
   * Error icon
   * - Large size for visibility
   * - Centered
   */
  icon: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },

  /**
   * Error title
   * - H2 typography (24px, semibold)
   * - Primary text color
   * - Centered
   */
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  /**
   * Error message
   * - Body typography (16px)
   * - Secondary text color
   * - Centered
   * - Multiple lines
   */
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },

  /**
   * Error details container (development only)
   * - Surface background
   * - Border for emphasis
   * - Padding
   * - Rounded corners
   */
  detailsContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.xl,
    maxWidth: '100%',
  },

  /**
   * Details title
   * - Body typography
   * - Bold weight
   * - Danger color for emphasis
   */
  detailsTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.danger,
    marginBottom: spacing.sm,
  },

  /**
   * Details text
   * - Caption typography (14px)
   * - Secondary text color
   * - Monospace font for code
   */
  detailsText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },

  /**
   * Retry button
   * - Full width for easy tapping
   */
  retryButton: {
    width: '100%',
  },
});
