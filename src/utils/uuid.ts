/**
 * UUID Utility Module
 *
 * Provides unique ID generation for tasks and checklist items.
 * CRITICAL: react-native-get-random-values must be imported first
 * to polyfill the crypto API in React Native environment.
 */

// CRITICAL: This import MUST be first to enable crypto API in React Native
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generates a unique identifier using UUID v4.
 *
 * Uses cryptographically strong random values to ensure uniqueness
 * across all devices and instances. The react-native-get-random-values
 * polyfill provides the necessary crypto API for React Native.
 *
 * @returns A UUID v4 string in the format "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
 * @example
 * const taskId = generateId();
 * // Returns: "550e8400-e29b-41d4-a716-446655440000"
 *
 * const itemId = generateId();
 * // Returns: "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
 */
export function generateId(): string {
  return uuidv4();
}
