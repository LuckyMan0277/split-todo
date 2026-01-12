/**
 * Supabase Client Configuration
 *
 * Provides a configured Supabase client for cloud storage and sync.
 *
 * Features:
 * - Automatic session persistence with AsyncStorage
 * - Auto-refresh tokens
 * - Type-safe database access
 *
 * Setup Instructions:
 * 1. Create a Supabase account at https://supabase.com
 * 2. Create a new project
 * 3. Get your project URL and anon key from Settings > API
 * 4. Create a .env file in the root directory with:
 *    EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
 *    EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
 */

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Database schema types for type-safe queries
 */
export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          items: any; // JSON field
          created_at: string;
          updated_at: string;
          schema_version: number;
        };
        Insert: {
          id: string;
          user_id?: string;
          title: string;
          items: any;
          created_at?: string;
          updated_at?: string;
          schema_version?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          items?: any;
          created_at?: string;
          updated_at?: string;
          schema_version?: number;
        };
      };
      daily_records: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          completed_count: number;
          total_count: number;
          completion_rate: number;
          saved_at: string;
          items: any; // JSON field
        };
        Insert: {
          id?: string;
          user_id?: string;
          date: string;
          completed_count: number;
          total_count: number;
          completion_rate: number;
          saved_at?: string;
          items?: any;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          completed_count?: number;
          total_count?: number;
          completion_rate?: number;
          saved_at?: string;
          items?: any;
        };
      };
    };
  };
}

/**
 * Supabase client instance
 *
 * Configured with:
 * - AsyncStorage for session persistence
 * - Auto-refresh tokens
 * - Detect session in URL (for OAuth redirects)
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Enable OAuth callback detection
  },
});

/**
 * Check if Supabase is properly configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}
