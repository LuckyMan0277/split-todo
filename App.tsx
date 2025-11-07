/**
 * App Entry Point
 *
 * Root component for the Split TODO React Native application.
 * Handles app initialization, navigation setup, and global providers.
 *
 * CRITICAL: react-native-get-random-values must be imported FIRST
 * to ensure UUID generation works correctly across all platforms.
 *
 * Features:
 * - ErrorBoundary for crash protection
 * - SafeAreaProvider for safe area support
 * - NavigationContainer for React Navigation
 * - Stack Navigator with 3 screens
 * - Store initialization with performance logging
 * - Loading/error states
 * - StatusBar configuration
 * - Toast notifications
 */

// CRITICAL: This import MUST be first to polyfill crypto.getRandomValues()
// Required for UUID generation to work on React Native
import 'react-native-get-random-values';

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Toast from 'react-native-toast-message';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

// Screens
import TaskListScreen from './src/screens/TaskListScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Store
import { useTaskStore } from './src/store/taskStore';

// Styles
import { colors } from './src/styles/colors';
import { typography } from './src/styles/typography';
import { spacing } from './src/styles/spacing';

// Utils
import { logger } from './src/utils/logger';

/**
 * Navigation stack parameter list
 * Defines all routes and their required parameters
 */
export type RootStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  Settings: undefined;
};

// Create the Stack Navigator
const Stack = createStackNavigator<RootStackParamList>();

/**
 * Main App Component
 *
 * Initialization flow:
 * 1. Mount and start performance timer
 * 2. Call store.initialize() to load data
 * 3. Log performance metrics
 * 4. Show loading UI during init
 * 5. Show error UI if init fails
 * 6. Show navigation UI once ready
 */
function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const { initialize, isLoading, error } = useTaskStore();

  /**
   * Initialize store on app mount
   * Measures and logs performance
   */
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info('App starting...');
        const timer = logger.startTimer('App initialization');

        // Initialize the task store (loads data from AsyncStorage)
        await initialize();

        // Log performance metrics
        timer.end();

        // Check if initialization took too long
        const endTime = Date.now();
        const startTime = endTime - (performance.now() || 0);
        const duration = endTime - startTime;

        if (duration > 500) {
          logger.warn('App initialization exceeded 500ms threshold', {
            duration: `${duration}ms`,
          });
        }

        logger.info('App initialization completed successfully');
        setIsInitializing(false);
      } catch (err) {
        logger.error('App initialization failed', err as Error);
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
        setInitError(errorMessage);
        setIsInitializing(false);
      }
    };

    initializeApp();
  }, [initialize]);

  /**
   * Retry initialization after error
   */
  const handleRetry = async () => {
    setInitError(null);
    setIsInitializing(true);

    try {
      logger.info('Retrying app initialization...');
      await initialize();
      logger.info('App initialization retry successful');
      setIsInitializing(false);
    } catch (err) {
      logger.error('App initialization retry failed', err as Error);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setInitError(errorMessage);
      setIsInitializing(false);
    }
  };

  /**
   * Loading State UI
   * Shown during initial data load
   */
  if (isInitializing || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Split TODO</Text>
      </View>
    );
  }

  /**
   * Error State UI
   * Shown if initialization fails
   */
  if (initError || error) {
    const displayError = initError || error || '알 수 없는 오류가 발생했습니다';

    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>앗, 문제가 발생했습니다</Text>
        <Text style={styles.errorMessage}>{displayError}</Text>
        <View style={styles.errorButton}>
          <Text
            style={styles.retryButtonText}
            onPress={handleRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            accessibilityHint="앱 초기화를 다시 시도합니다"
          >
            다시 시도
          </Text>
        </View>
      </View>
    );
  }

  /**
   * Main Navigation UI
   * Shown once app is initialized successfully
   */
  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <Stack.Navigator
        initialRouteName="TaskList"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            ...typography.h3,
          },
        }}
      >
        <Stack.Screen
          name="TaskList"
          component={TaskListScreen}
          options={{
            title: 'Split TODO',
          }}
        />
        <Stack.Screen
          name="TaskDetail"
          component={TaskDetailScreen}
          options={{
            title: '할 일 세부사항',
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            title: '설정',
          }}
        />
      </Stack.Navigator>
      {/* Toast component for notifications (must be outside NavigationContainer) */}
      <Toast />
    </NavigationContainer>
  );
}

/**
 * Root component with ErrorBoundary and SafeAreaProvider
 */
export default function AppWithProviders() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <App />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  /**
   * Loading container
   * - Full screen
   * - Centered content
   * - Background color
   */
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Loading text
   * - H2 typography (24px, semibold)
   * - Primary text color
   * - Spacing above spinner
   */
  loadingText: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },

  /**
   * Error container
   * - Full screen
   * - Centered content
   * - Padding for readability
   */
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },

  /**
   * Error icon
   * - Large size for visibility
   */
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },

  /**
   * Error title
   * - H2 typography
   * - Primary text color
   * - Centered
   */
  errorTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  /**
   * Error message
   * - Body typography
   * - Secondary text color
   * - Centered
   * - Multiple lines
   */
  errorMessage: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },

  /**
   * Error button container
   * - Minimum touch target size
   */
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
    minHeight: 44,
    minWidth: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Retry button text
   * - Body typography
   * - White color
   * - Bold
   */
  retryButtonText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
});
