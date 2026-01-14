/**
 * Lib Module - Single barrel exporter
 * Centralizes all exports from lib/* so consumers can import from '@/lib'
 */

// ===== API =====
export * from './api/request-manager';

// ===== Cache =====
export * from './cache';

// ===== Auth =====
export * from './auth/auth-attempt-guard';
export * from './auth/authService';
export * from './auth/emailUtils';
export * from './auth/redirectSafety';
export * from './auth/sessionService';
export * from './auth/useAuthGuard';
export * from './auth/useResetPasswordConfirm';
export * from './auth/useSignInForm';
export * from './auth/useSignUpForm';
export * from './auth/useWelcomeScreen';
export * from './auth/validation';
// ===== Routing config =====
export * from './routing/route-config';

// ===== Navigation =====
export * from './navigation/navigation-config';
export * from './navigation/uri-helpers';

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
export * from './analytics';
export * from './auth/auth-state';
export * from './auth/encrypted-storage';
export * from './worlds/useWorlds';


