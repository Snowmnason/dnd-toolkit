/**
 * Lib Module - Main library exports
 * Provides centralized access to all library functionality
 */

// Auth exports
export * from './auth';

// Database exports
export * from './database';

// Utils exports
export * from './utils';

// Individual module exports for convenience
export { AuthStateManager } from './auth-state';
export { supabase } from './supabase';

