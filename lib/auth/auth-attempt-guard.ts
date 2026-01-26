import { STORAGE_KEYS } from "../storage/index";
import { getStorageBackend } from "../storage/privacy";
import { logger } from "../utils/logger";

// Lazy import Sentry only when needed to reduce bundle size when disabled
const getSentry = async () => {
  try {
    return await import("@sentry/react-native");
  } catch {
    return null;
  }
};

let sentryInstance: any = null;
const initSentryInstance = async () => {
  if (!sentryInstance) {
    sentryInstance = await getSentry();
  }
  return sentryInstance;
};

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
    const backend = getStorageBackend(STORAGE_KEYS.AUTH_ATTEMPTS);
    const raw = await backend.getItem(STORAGE_KEYS.AUTH_ATTEMPTS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (error) {
    logger.error("security", "Failed to load auth attempt store", error);
    return {};
  }
};

const persistStore = async (store: Record<string, AttemptRecord>) => {
  try {
    const backend = getStorageBackend(STORAGE_KEYS.AUTH_ATTEMPTS);
    await backend.setJSON(STORAGE_KEYS.AUTH_ATTEMPTS, store);
  } catch (error) {
    logger.error("security", "Failed to persist auth attempt store", error);
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
    // Report lockout to Sentry asynchronously if available (don't block rate limit logic)
    initSentryInstance()
      .then((Sentry) => {
        try {
          if (Sentry?.captureMessage) {
            Sentry.captureMessage("auth.lockout", {
              level: "warning",
              tags: {
                scope,
                emailDomain: email.split("@")[1] || "unknown",
              },
              extra: {
                attempts: record.attempts,
                windowMs: WINDOW_MS,
                lockoutMs: LOCKOUT_MS,
              },
            });
          }
        } catch {
          logger.debug(
            "security",
            "Sentry disabled or failed to report lockout",
          );
        }
      })
      .catch(() => {
        // Sentry init failed, continue without reporting
      });
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
