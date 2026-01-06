/**
 * Lib Module - Single barrel exporter
 * Centralizes all exports from lib/* so consumers can import from '@/lib'
 */

// ===== Auth =====
export * from './auth/authService';
export * from './auth/emailUtils';
export * from './auth/redirectSafety';
export * from './auth/sessionService';
export * from './auth/useResetPasswordConfirm';
export * from './auth/useSignInForm';
export * from './auth/useSignUpForm';
export * from './auth/useWelcomeScreen';
export * from './auth/validation';

// ===== Database =====
export * from './database/common';
export * from './database/invites';
export * from './database/supabase';
export * from './database/users';
export * from './database/worlds';

// ===== Settings =====
export * from './settings/deleteAccount';
export * from './settings/signOut';
export * from './settings/updateUsername';

// ===== Utils =====
export { default as Logger, logger } from './utils/logger';

// ===== Error Handling =====
export * from './error';

// ===== Other top-level lib utilities =====
export * from './auth-state';
export * from './auth/encrypted-storage';
export * from './worlds/useWorlds';


