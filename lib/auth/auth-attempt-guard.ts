
import { reportError } from "@/lib/error";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";
import { getPrivacyStorageBackend } from "@/middleware/storage";
import { currentConsentLevel } from "@/type-definitions/analytics-types";

export type AuthGuardScope = "signin" | "signup" | "reset";

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

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

const normalizeKey = (email: string, scope: AuthGuardScope) =>
  `${scope}:${email.trim().toLowerCase()}`;

const loadStore = async (): Promise<Record<string, AttemptRecord>> => {
  try {
    const backend = getPrivacyStorageBackend(STORAGE_KEYS.AUTH_ATTEMPTS);
    const raw = await backend.getItem(STORAGE_KEYS.AUTH_ATTEMPTS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    logger.category('security').error("Failed to load auth attempt store", error);
    return {};
  }
};

const persistStore = async (store: Record<string, AttemptRecord>) => {
  try {
    const backend = getPrivacyStorageBackend(STORAGE_KEYS.AUTH_ATTEMPTS);
    await backend.setJSON(STORAGE_KEYS.AUTH_ATTEMPTS, store);
  } catch (error) {
    logger.category('security').error("Failed to persist auth attempt store", error);
  }
};

export const checkAuthGuard = async (
  email: string,
  scope: AuthGuardScope = "signin",
): Promise<GuardResult> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  const now = Date.now();
  // eslint-disable-next-line security/detect-object-injection
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

export const recordAuthSuccess = async (
  email: string,
  scope: AuthGuardScope = "signin",
): Promise<void> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  // eslint-disable-next-line security/detect-object-injection
  if (store[key]) {
    // eslint-disable-next-line security/detect-object-injection
    delete store[key];
    await persistStore(store);
  }
};

export const recordAuthFailure = async (
  email: string,
  scope: AuthGuardScope = "signin",
): Promise<GuardResult> => {
  const key = normalizeKey(email, scope);
  const store = await loadStore();
  const now = Date.now();
  // eslint-disable-next-line security/detect-object-injection
  const record = store[key] || { attempts: 0, firstAttempt: now };

  if (now - record.firstAttempt > WINDOW_MS) {
    record.attempts = 0;
    record.firstAttempt = now;
  }

  record.attempts += 1;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    // Report lockout to error tracker with structured security telemetry
    // Respect user's analytics consent preference.
    // NOTE: This gates telemetry reporting but NOT the lockout itself (which always enforces).
    // Trade-off: if consent='none', we lose audit trail of abuse attempts, but honor user's opt-out.
    // Future: Consider making security events bypass consent (requires policy decision).
    if (currentConsentLevel !== 'none') {
      try {
        const emailDomain = email.split('@')[1] || 'unknown';
        reportError(
          new Error('auth.lockout'),
          {
            level: 'warning',
            tags: {
              event_type: 'auth_lockout',
              scope,
              email_domain: emailDomain,
            },
            extra: {
              attempts: record.attempts,
              max_attempts: MAX_ATTEMPTS,
              lockout_duration_ms: LOCKOUT_MS,
              lockout_until: record.lockedUntil,
              window_ms: WINDOW_MS,
            },
          }
        );
      } catch {
        logger.category('security').debug(
          "Error tracker disabled or failed to report lockout",
        );
      }
    }
  }

  // eslint-disable-next-line security/detect-object-injection
  store[key] = record;
  await persistStore(store);

  const remaining = Math.max(0, MAX_ATTEMPTS - record.attempts);
  return {
    allowed: record.lockedUntil ? false : remaining > 0,
    remaining,
    retryAfterMs: record.lockedUntil ? record.lockedUntil - now : undefined,
  };
};
