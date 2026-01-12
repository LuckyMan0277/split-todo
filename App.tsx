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
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Toast from 'react-native-toast-message';
import * as Linking from 'expo-linking';

// Components
import ErrorBoundary from './src/components/ErrorBoundary';

// Screens
import TaskListScreen from './src/screens/TaskListScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TodayScreen from './src/screens/TodayScreen';
import TodaySelectScreen from './src/screens/TodaySelectScreen';

// Store
import { useTaskStore, cleanupTaskStore } from './src/store/taskStore';
import { stopDailySaveScheduler } from './src/services/dailySaveScheduler';

// Styles
import { colors } from './src/styles/colors';
import { typography } from './src/styles/typography';
import { spacing } from './src/styles/spacing';

// Utils
import { logger } from './src/utils/logger';

/**
 * Navigation parameter lists
 */
export type RootTabParamList = {
  TaskListTab: undefined;
  TodayTab: undefined;
  SettingsTab: undefined;
};

export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
};

export type TodayStackParamList = {
  Today: undefined;
  TodaySelect: undefined;
  TaskDetail: { taskId: string };
};

export type SettingsStackParamList = {
  Settings: undefined;
};

// Create navigators
const Tab = createBottomTabNavigator<RootTabParamList>();
const TaskStack = createStackNavigator<TaskStackParamList>();
const TodayStack = createStackNavigator<TodayStackParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

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
   * Cleanup on unmount to prevent memory leaks
   */
  useEffect(() => {
    const initializeApp = async () => {
      try {
        logger.info('App starting...');
        const timer = logger.startTimer('App initialization');
        const startTime = Date.now();

        // Add timeout for initialization (10 seconds max)
        const initPromise = initialize();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('초기화 시간 초과 (10초)')), 10000);
        });

        // Race between initialization and timeout
        await Promise.race([initPromise, timeoutPromise]);

        // Log performance metrics
        timer.end();

        // Check if initialization took too long
        const endTime = Date.now();
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

    // Cleanup on unmount
    return () => {
      logger.info('App unmounting, cleaning up...');
      cleanupTaskStore();
      stopDailySaveScheduler();
    };
  }, [initialize]);

  /**
   * Handle deep links for OAuth callbacks
   */
  useEffect(() => {
    // For web, check URL hash for OAuth tokens
    if (Platform.OS === 'web') {
      const hash = window.location.hash;
      const href = window.location.href;

      if (hash && (hash.includes('access_token') || hash.includes('code='))) {
        logger.info('Web OAuth callback detected', { url: href });
        handleOAuthCallback(href);
      }
    }

    // Check for initial URL when app starts (from OAuth redirect)
    Linking.getInitialURL().then((url) => {
      if (url) {
        logger.info('Initial URL received', { url });
        handleOAuthCallback(url);
      }
    });

    // Handle deep link when app is opened via URL
    const subscription = Linking.addEventListener('url', ({ url }) => {
      logger.info('Deep link received', { url });
      handleOAuthCallback(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  /**
   * Handle OAuth callback from deep link
   */
  const handleOAuthCallback = async (url: string) => {
    try {
      // Check if this is an OAuth callback (contains access_token or code)
      if (url.includes('access_token') || url.includes('code=')) {
        logger.info('OAuth callback detected, processing...');

        // Wait longer for Supabase to process the session
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Reload user profile after OAuth
        const { loadUserProfile, syncWithCloud } = useTaskStore.getState();
        await loadUserProfile();

        // Perform initial sync after login
        logger.info('Starting initial sync after OAuth login...');
        const syncResult = await syncWithCloud();

        if (syncResult.success) {
          logger.info('Initial sync completed after OAuth login');
        } else {
          logger.warn('Initial sync failed after OAuth login', { error: syncResult.error });
        }

        logger.info('OAuth callback processed successfully');

        // For web, clean up the hash from URL
        if (Platform.OS === 'web') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (error) {
      logger.error('Failed to handle OAuth callback', error as Error);
    }
  };

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
    // Expo handles require('./assets/icon.png') for both web and native
    const iconSource = require('./assets/icon.png');

    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
        <Image source={iconSource} style={styles.splashIcon} resizeMode="contain" />
        <Text style={styles.loadingText}>Split TODO</Text>
        {__DEV__ && (
          <Text style={{ color: 'white', fontSize: 12, marginTop: 20 }}>
            Debug: initializing={String(isInitializing)}, loading={String(isLoading)}
          </Text>
        )}
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
    <View style={{ flex: 1 }}>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <Tab.Navigator
          initialRouteName="TaskListTab"
          screenOptions={{
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textSecondary,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              height: 100,
              paddingBottom: 16,
              paddingTop: 16,
            },
            tabBarLabelStyle: {
              ...typography.caption,
              fontSize: 11,
            },
            headerShown: false,
          }}
        >
          <Tab.Screen
            name="TaskListTab"
            component={TaskStackNavigator}
            options={{
              title: '전체',
              tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>📋</Text>,
            }}
            listeners={({ navigation }) => ({
              blur: () => {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  const state = navigation.getState();
                  const taskListRoute = state.routes.find((r) => r.name === 'TaskListTab');

                  // Only reset if there are nested screens
                  if (taskListRoute?.state?.index && taskListRoute.state.index > 0) {
                    navigation.reset({
                      index: state.index,
                      routes: state.routes.map((route) => {
                        if (route.name === 'TaskListTab') {
                          return {
                            ...route,
                            state: {
                              ...route.state,
                              index: 0,
                              routes: route.state?.routes ? [route.state.routes[0]] : [],
                            },
                          };
                        }
                        return route;
                      }),
                    });
                  }
                }, 0);
              },
            })}
          />
          <Tab.Screen
            name="TodayTab"
            component={TodayStackNavigator}
            options={{
              title: '오늘',
              tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>📅</Text>,
            }}
            listeners={({ navigation }) => ({
              blur: () => {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  const state = navigation.getState();
                  const todayRoute = state.routes.find((r) => r.name === 'TodayTab');

                  // Only reset if there are nested screens
                  if (todayRoute?.state?.index && todayRoute.state.index > 0) {
                    navigation.reset({
                      index: state.index,
                      routes: state.routes.map((route) => {
                        if (route.name === 'TodayTab') {
                          return {
                            ...route,
                            state: {
                              ...route.state,
                              index: 0,
                              routes: route.state?.routes ? [route.state.routes[0]] : [],
                            },
                          };
                        }
                        return route;
                      }),
                    });
                  }
                }, 0);
              },
            })}
          />
          <Tab.Screen
            name="SettingsTab"
            component={SettingsStackNavigator}
            options={{
              title: '설정',
              tabBarIcon: ({ color, size }) => <Text style={{ fontSize: size, color }}>⚙️</Text>,
            }}
            listeners={({ navigation }) => ({
              blur: () => {
                // Use setTimeout to avoid state update during render
                setTimeout(() => {
                  const state = navigation.getState();
                  const settingsRoute = state.routes.find((r) => r.name === 'SettingsTab');

                  // Only reset if there are nested screens
                  if (settingsRoute?.state?.index && settingsRoute.state.index > 0) {
                    navigation.reset({
                      index: state.index,
                      routes: state.routes.map((route) => {
                        if (route.name === 'SettingsTab') {
                          return {
                            ...route,
                            state: {
                              ...route.state,
                              index: 0,
                              routes: route.state?.routes ? [route.state.routes[0]] : [],
                            },
                          };
                        }
                        return route;
                      }),
                    });
                  }
                }, 0);
              },
            })}
          />
        </Tab.Navigator>
        {/* Toast component for notifications (must be outside NavigationContainer) */}
        <Toast />
      </NavigationContainer>
    </View>
  );
}

/**
 * Task Stack Navigator
 */
function TaskStackNavigator() {
  return (
    <TaskStack.Navigator
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
      <TaskStack.Screen
        name="TaskList"
        component={TaskListScreen}
        options={{
          title: 'Split TODO',
        }}
      />
      <TaskStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{
          title: '할 일 세부사항',
        }}
      />
    </TaskStack.Navigator>
  );
}

/**
 * Today Stack Navigator
 */
function TodayStackNavigator() {
  return (
    <TodayStack.Navigator
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
      <TodayStack.Screen
        name="Today"
        component={TodayScreen}
        options={{
          title: '오늘 할 일',
        }}
      />
      <TodayStack.Screen
        name="TodaySelect"
        component={TodaySelectScreen}
        options={({ navigation }) => ({
          title: '오늘 할 일 선택',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={{ paddingRight: 16 }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="완료"
            >
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>완료</Text>
            </TouchableOpacity>
          ),
        })}
      />
      <TodayStack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{
          title: '할 일 세부사항',
        }}
      />
    </TodayStack.Navigator>
  );
}

/**
 * Settings Stack Navigator
 */
function SettingsStackNavigator() {
  return (
    <SettingsStack.Navigator
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
      <SettingsStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: '설정',
        }}
      />
    </SettingsStack.Navigator>
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
   * - Indigo background color
   */
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.primary, // Indigo background for splash screen
    justifyContent: 'center',
    alignItems: 'center',
  },

  /**
   * Splash icon
   * - Large icon for splash screen
   * - Fixed size for consistency
   */
  splashIcon: {
    width: 120,
    height: 120,
    marginBottom: spacing.lg,
  },

  /**
   * Loading text
   * - H2 typography (24px, semibold)
   * - White text on indigo background
   * - Spacing above spinner
   */
  loadingText: {
    ...typography.h2,
    color: '#ffffff', // White text for indigo background
    marginTop: spacing.md,
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
