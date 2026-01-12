/**
 * Encrypted Storage Service
 *
 * Provides secure encrypted storage for sensitive data using Expo SecureStore:
 * - iOS: Keychain Services
 * - Android: SharedPreferences with Android Keystore encryption
 * - Web: Falls back to AsyncStorage (not encrypted on web)
 *
 * This service wraps expo-secure-store to provide:
 * - Automatic encryption/decryption
 * - Error handling
 * - Logging
 * - Type-safe operations
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Saves data to encrypted storage.
 * @param key - Storage key
 * @param data - Data to store (will be JSON stringified)
 * @returns Promise that resolves when save is complete
 */
export async function saveEncrypted(key: string, data: any): Promise<void> {
  try {
    const serialized = JSON.stringify(data);

    // Use AsyncStorage for web, SecureStore for native
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, serialized);
    } else {
      await SecureStore.setItemAsync(key, serialized);
    }
  } catch (error) {
    logger.error(`Failed to save encrypted data for key: ${key}`, error as Error);
    throw error;
  }
}

/**
 * Loads data from encrypted storage.
 * @param key - Storage key
 * @returns Promise that resolves with the data, or null if not found
 */
export async function loadEncrypted<T = any>(key: string): Promise<T | null> {
  try {
    let serialized: string | null;

    // Use AsyncStorage for web, SecureStore for native
    if (Platform.OS === 'web') {
      serialized = await AsyncStorage.getItem(key);
    } else {
      serialized = await SecureStore.getItemAsync(key);
    }

    if (!serialized) {
      return null;
    }

    const data = JSON.parse(serialized) as T;
    return data;
  } catch (error) {
    logger.error(`Failed to load encrypted data for key: ${key}`, error as Error);
    return null;
  }
}
