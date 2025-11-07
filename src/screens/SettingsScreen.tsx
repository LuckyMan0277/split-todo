/**
 * SettingsScreen Component
 *
 * Settings and preferences screen for the application.
 * Features data management, app information, and accessibility settings.
 *
 * Accessibility:
 * - Full screen reader support
 * - 44x44pt minimum touch targets
 * - Clear section headings
 *
 * Features:
 * - Data export/import buttons
 * - Delete completed tasks button
 * - App version display
 * - Storage usage display
 * - Haptic feedback toggle
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTaskStore } from '../store/taskStore';
import { Button } from '../components';
import { exportData } from '../services/backup';
import { cleanOldCompletedTasks } from '../services/storage';
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
  const { tasks } = useTaskStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
   * Handles data export
   */
  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const appData = { schemaVersion: 1, tasks };
      await exportData(appData);
      Alert.alert('내보내기 완료', '백업 파일이 저장되었습니다');
    } catch (error: any) {
      Alert.alert(
        '내보내기 실패',
        error.message || '데이터 내보내기에 실패했습니다'
      );
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Handles data import
   * Note: In a real implementation, this would use DocumentPicker to select a file
   */
  const handleImportData = async () => {
    Alert.alert(
      '데이터 가져오기',
      '이 기능은 파일 선택기가 필요합니다.\n현재 버전에서는 지원하지 않습니다.',
      [{ text: '확인' }]
    );
    // In a real implementation:
    // 1. Use react-native-document-picker to select a file
    // 2. Call importData(filePath)
    // 3. Validate the data
    // 4. Show confirmation dialog (will overwrite existing data)
    // 5. Update store with new data
  };

  /**
   * Handles deleting completed tasks
   */
  const handleDeleteCompleted = async () => {
    const completedCount = tasks.filter((task) => {
      const completedItems = task.items.filter((item) => item.done).length;
      return completedItems === task.items.length && task.items.length > 0;
    }).length;

    if (completedCount === 0) {
      Alert.alert('알림', '삭제할 완료된 할 일이 없습니다');
      return;
    }

    Alert.alert(
      '완료된 할 일 삭제',
      `${completedCount}개의 완료된 할 일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`,
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const appData = { schemaVersion: 1, tasks };
              const cleanedData = cleanOldCompletedTasks(appData);

              // Update store with cleaned data
              useTaskStore.setState({ tasks: cleanedData.tasks });

              Alert.alert('삭제 완료', `${completedCount}개의 할 일이 삭제되었습니다`);
            } catch (error: any) {
              Alert.alert(
                '삭제 실패',
                error.message || '할 일 삭제에 실패했습니다'
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  /**
   * Handles haptic feedback toggle
   */
  const handleHapticToggle = async (value: boolean) => {
    setHapticEnabled(value);
    try {
      await AsyncStorage.setItem(HAPTIC_ENABLED_KEY, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save haptic setting', error);
    }
  };

  // Load haptic setting on mount
  React.useEffect(() => {
    const loadHapticSetting = async () => {
      try {
        const saved = await AsyncStorage.getItem(HAPTIC_ENABLED_KEY);
        if (saved !== null) {
          setHapticEnabled(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Failed to load haptic setting', error);
      }
    };
    loadHapticSetting();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Data Management Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>데이터 관리</Text>

        <Button
          variant="primary"
          onPress={handleExportData}
          loading={isExporting}
          style={styles.button}
          accessibilityLabel="데이터 내보내기"
          accessibilityHint="백업 파일을 생성하여 저장합니다"
        >
          데이터 내보내기
        </Button>

        <Button
          variant="secondary"
          onPress={handleImportData}
          style={styles.button}
          accessibilityLabel="데이터 가져오기"
          accessibilityHint="백업 파일에서 데이터를 복원합니다"
        >
          데이터 가져오기
        </Button>

        <Button
          variant="danger"
          onPress={handleDeleteCompleted}
          loading={isDeleting}
          style={styles.button}
          accessibilityLabel="완료된 할 일 삭제"
          accessibilityHint="100% 완료된 할 일을 모두 삭제합니다"
        >
          완료된 할 일 삭제
        </Button>
      </View>

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
            <Text style={styles.settingDescription}>
              체크박스 토글 시 진동 피드백 제공
            </Text>
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
          <Text style={styles.infoValue}>
            {Platform.OS === 'ios' ? 'iOS' : 'Android'}
          </Text>
        </View>

        <Text style={styles.footerText}>
          할 일을 작은 단계로 쪼개어 달성하세요
        </Text>
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
   * Button with margin
   */
  button: {
    marginBottom: spacing.md,
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
});
