/**
 * SettingsScreen Component
 *
 * Settings and preferences screen for the application.
 * Features app information and accessibility settings.
 *
 * Accessibility:
 * - Full screen reader support
 * - 44x44pt minimum touch targets
 * - Clear section headings
 *
 * Features:
 * - App version display
 * - Storage usage display
 * - Haptic feedback toggle
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Platform, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '../store/taskStore';
import { calculateStorageSize } from '../utils/validation';
import { colors } from '../styles/colors';
import { typography } from '../styles/typography';
import { spacing } from '../styles/spacing';

// Package version (should match package.json)
const APP_VERSION = '1.0.0';

// Haptic feedback setting key
const HAPTIC_ENABLED_KEY = 'HAPTIC_ENABLED';

/**
 * SettingsScreen component implementation
 */
const SettingsScreen: React.FC = () => {
  const { tasks, settings, toggleCelebration, updateDailySaveHour, toggleWeekStartsOn } =
    useTaskStore();
  const [hapticEnabled, setHapticEnabled] = useState(true);

  // Calculate storage statistics
  const storageStats = useMemo(() => {
    const appData = { schemaVersion: 1, tasks };
    const sizeInBytes = calculateStorageSize(appData);
    const sizeInKB = (sizeInBytes / 1024).toFixed(2);
    const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
    const maxSizeInMB = 5;
    const percentUsed = Math.round((sizeInBytes / (maxSizeInMB * 1024 * 1024)) * 100);

    const totalItems = tasks.reduce((sum, task) => sum + task.items.length, 0);

    return {
      taskCount: tasks.length,
      itemCount: totalItems,
      sizeInBytes,
      sizeFormatted: sizeInBytes < 1024 * 1024 ? `${sizeInKB} KB` : `${sizeInMB} MB`,
      percentUsed,
    };
  }, [tasks]);

  /**
   * Handles haptic feedback toggle
   */
  const handleHapticToggle = async (value: boolean) => {
    setHapticEnabled(value);
    try {
      await AsyncStorage.setItem(HAPTIC_ENABLED_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save haptic setting:', error);
    }
  };

  /**
   * Load haptic feedback setting on mount
   */
  useEffect(() => {
    const loadHapticSetting = async () => {
      try {
        const value = await AsyncStorage.getItem(HAPTIC_ENABLED_KEY);
        if (value !== null) {
          setHapticEnabled(JSON.parse(value));
        }
      } catch (error) {
        console.error('Failed to load haptic setting:', error);
      }
    };
    loadHapticSetting();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Storage Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>저장 공간</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>할 일 개수:</Text>
          <Text style={styles.infoValue}>{storageStats.taskCount}개</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>체크리스트 항목:</Text>
          <Text style={styles.infoValue}>{storageStats.itemCount}개</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>사용 중인 공간:</Text>
          <Text style={styles.infoValue}>{storageStats.sizeFormatted}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>저장 공간 사용률:</Text>
          <Text style={styles.infoValue}>{storageStats.percentUsed}%</Text>
        </View>
      </View>

      {/* Accessibility Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>접근성</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>햅틱 피드백</Text>
            <Text style={styles.settingDescription}>체크박스 토글 시 진동 피드백 제공</Text>
          </View>
          <Switch
            value={hapticEnabled}
            onValueChange={handleHapticToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
            accessible={true}
            accessibilityLabel="햅틱 피드백 설정"
            accessibilityRole="switch"
            accessibilityState={{ checked: hapticEnabled }}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>완료 축하 효과</Text>
            <Text style={styles.settingDescription}>진행률 100% 달성 시 축하 애니메이션 표시</Text>
          </View>
          <Switch
            value={settings.celebrationEnabled}
            onValueChange={toggleCelebration}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
            accessible={true}
            accessibilityLabel="완료 축하 효과 설정"
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.celebrationEnabled }}
          />
        </View>
      </View>

      {/* Calendar Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>캘린더</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>일일 자동 저장 시간</Text>
            <Text style={styles.settingDescription}>
              오늘 할 일 완료 기록을 자동 저장할 시간 (0-23시)
            </Text>
          </View>
          <View style={styles.timeInputContainer}>
            <TextInput
              style={styles.timeInput}
              value={String(settings.dailySaveHour)}
              onChangeText={(text) => {
                const hour = parseInt(text, 10);
                if (!isNaN(hour) && hour >= 0 && hour <= 23) {
                  updateDailySaveHour(hour);
                } else if (text === '') {
                  // Allow empty for editing
                  return;
                }
              }}
              keyboardType="number-pad"
              maxLength={2}
              accessible={true}
              accessibilityLabel="저장 시간"
              accessibilityHint="0부터 23 사이의 시간을 입력하세요"
            />
            <Text style={styles.timeUnit}>시</Text>
          </View>
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingTextContainer}>
            <Text style={styles.settingLabel}>주 시작 요일</Text>
            <Text style={styles.settingDescription}>
              {settings.weekStartsOn === 0 ? '일요일부터 시작' : '월요일부터 시작'}
            </Text>
          </View>
          <Switch
            value={settings.weekStartsOn === 1}
            onValueChange={toggleWeekStartsOn}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
            accessible={true}
            accessibilityLabel="주 시작 요일 설정"
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.weekStartsOn === 1 }}
            accessibilityHint="켜면 월요일부터, 끄면 일요일부터 시작합니다"
          />
        </View>
      </View>

      {/* App Info Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 정보</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>앱 이름:</Text>
          <Text style={styles.infoValue}>Split TODO</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>버전:</Text>
          <Text style={styles.infoValue}>{APP_VERSION}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>플랫폼:</Text>
          <Text style={styles.infoValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
        </View>

        <Text style={styles.footerText}>할 일을 작은 단계로 쪼개어 달성하세요</Text>
      </View>
    </ScrollView>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  /**
   * Main container
   */
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /**
   * Content container
   */
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  /**
   * Section container
   */
  section: {
    marginBottom: spacing.xxl,
  },

  /**
   * Section title
   */
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },

  /**
   * Info row (label + value)
   */
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  /**
   * Info label
   */
  infoLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },

  /**
   * Info value
   */
  infoValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },

  /**
   * Setting row (label + switch)
   */
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 44, // Ensure touch target
  },

  /**
   * Setting text container
   */
  settingTextContainer: {
    flex: 1,
    marginRight: spacing.lg,
  },

  /**
   * Setting label
   */
  settingLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  /**
   * Setting description
   */
  settingDescription: {
    ...typography.caption,
    color: colors.textSecondary,
  },

  /**
   * Footer text
   */
  footerText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },

  /**
   * Time input container
   */
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  /**
   * Time input
   */
  timeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    minWidth: 50,
    backgroundColor: colors.surface,
  },

  /**
   * Time unit label
   */
  timeUnit: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 8,
  },
});
