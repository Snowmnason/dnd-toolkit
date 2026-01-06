import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

import { EncryptedStorage } from './encrypted-storage';

export type AuthGuardScope = 'signin' | 'signup' | 'reset';

interface AttemptRecord {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: number;
}

interface GuardResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const STORAGE_KEY = 'dnd_auth_attempts';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Use sessionStorage on web (clears on tab close, more appropriate for temporary security state)
// Use encrypted storage on native platforms
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
      return null;
    }
    return EncryptedStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
      }
      return;
    }
    await EncryptedStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
      }
      return;
    }
    await EncryptedStorage.removeItem(key);
  },
};

const normalizeKey = (email: string, scope: AuthGuardScope) => `${scope}:${email.trim().toLowerCase()}`;

const loadStore = async (): Promise<Record<string, AttemptRecord>> => {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    logger.error('auth-guard', 'Failed to load auth attempt store', error);
    return {};
  }
};

const persistStore = async (store: Record<string, AttemptRecord>) => {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    logger.error('auth-guard', 'Failed to persist auth attempt store', error);
  }
};

export const checkAuthGuard = async (email: string, scope: AuthGuardScope = 'signin'): Promise<GuardResult> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  const now = Date.now();
  const record = store[key];

  if (record?.lockedUntil && record.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: record.lockedUntil - now,
    };
  }

  if (!record) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  // Reset window if expired
  if (now - record.firstAttempt > WINDOW_MS) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return { allowed: remaining > 0, remaining };
};

export const recordAuthSuccess = async (email: string, scope: AuthGuardScope = 'signin'): Promise<void> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  if (store[key]) {
    delete store[key];
    await persistStore(store);
  }
};

export const recordAuthFailure = async (email: string, scope: AuthGuardScope = 'signin'): Promise<GuardResult> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  const now = Date.now();

  const record = store[key] || { attempts: 0, firstAttempt: now };

  if (now - record.firstAttempt > WINDOW_MS) {
    record.attempts = 0;
    record.firstAttempt = now;
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    try {
      const capture = (Sentry as any)?.captureMessage;
      if (typeof capture === 'function') {
        capture('auth.lockout', {
          level: 'warning',
          tags: {
            scope,
            emailDomain: email.split('@')[1] || 'unknown',
          },
          extra: {
            attempts: record.attempts,
            windowMs: WINDOW_MS,
            lockoutMs: LOCKOUT_MS,
          },
        });
      }
    } catch (err) {
      logger.debug('auth-guard', 'Sentry disabled or failed to report lockout');
    }
  }

  store[key] = record;
  await persistStore(store);

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return {
    allowed: record.lockedUntil ? false : remaining > 0,
    remaining,
    retryAfterMs: record.lockedUntil ? record.lockedUntil - now : undefined,
  };
};
