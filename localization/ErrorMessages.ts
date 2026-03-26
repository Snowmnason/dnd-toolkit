import {
    RecoveryAction,
    SafeModeReason,
} from "@/lib/error";

/**
 * Error Messages — D&D-themed messages for error/fallback screens.
 *
 * Shared across all error fallback UIs. Import from `@/localization`.
 */

/** Fun D&D-themed error messages for general crashes and errors */
export const ERROR_MESSAGES = [
  "Oops! Someone spilled a drink on the character sheet!",
  "Oops! Your pencil broke mid-session!",
  "Oops! We encountered a TPK!",
  "Oops! The DM's notes got eaten by the dog!",
  "Oops! Natural 1!",
  "Oops! The dice rolled off the table!",
  "Oops! Someone forgot to bring snacks!",
  "Oops! The dragon decided to show up early!",
  "Oops! Critical fumble on the app loading!",
  "Oops! The tavern ran out of ale!",
  "Oops! Your spell fizzled!",
  "Oops! The mimic was actually the treasure chest!",
] as const;

/** Safe mode-specific messages (degraded/recovery state) */
export const SAFE_MODE_MESSAGES = [
  "\u26A0\uFE0F The DM needs to pause the session",
  "\u26A0\uFE0F A critical scroll was lost!",
  "\u26A0\uFE0F The tavern is temporarily closed",
  "\u26A0\uFE0F Your map is unraveling!",
  "\u26A0\uFE0F The dungeon is unstable",
  "\u26A0\uFE0F Your dice are acting strange",
  "\u26A0\uFE0F The spell backfired!",
  "\u26A0\uFE0F A magical barrier appeared",
] as const;

/** Navigation error messages (route-level failures) */
export const NAVIGATION_ERROR_MESSAGES = [
  "\uD83D\uDDFA\uFE0F The map led to a dead end!",
  "\uD83D\uDDFA\uFE0F You wandered off the trail!",
] as const;

/** Pick a random message from a given array */
export function getRandomMessage(messages: readonly string[]): string {
  return messages[Math.floor(Math.random() * messages.length)];
}

/** Human-readable safe mode reason descriptions */
export function getSafeModeDescription(reason: SafeModeReason): string {
  switch (reason) {
    case SafeModeReason.STORAGE_UNREADABLE:
      return "Your app data cannot be read right now. This is usually temporary.";
    case SafeModeReason.STORAGE_CORRUPTED:
      return "Your app data may be corrupted. You can clear the cache to recover.";
    case SafeModeReason.STORAGE_QUOTA_EXCEEDED:
      return "Your device is running out of storage space. Try clearing some space.";

    case SafeModeReason.AUTH_EXPIRED:
      return "Your session has expired. Please log in again to continue.";
    case SafeModeReason.AUTH_INVALID:
      return "Your authentication is invalid. Please try logging in again.";
    case SafeModeReason.SESSION_LOST:
      return "Your session was lost. Please log in again.";

    case SafeModeReason.KERNEL_TIMEOUT:
      return "The app took too long to start. Try restarting the app.";
    case SafeModeReason.KERNEL_PRELOAD_FAILED:
      return "Some app resources failed to load. Try restarting.";
    case SafeModeReason.KERNEL_CONFIG_FAILED:
      return "App configuration failed. Try restarting.";

    case SafeModeReason.NETWORK_SYNC_FAILURES:
      return "We're having trouble syncing your data. Check your internet connection.";
    case SafeModeReason.NETWORK_CASCADE:
      return "Multiple network failures detected. Check your connection and try again.";
    case SafeModeReason.NETWORK_UNAVAILABLE:
      return "No internet connection detected. Some features are unavailable.";

    case SafeModeReason.UNKNOWN:
    default:
      return "Something went wrong. Your adventure is safe\u2014we're working on it!";
  }
}

/** Get recovery action label for UI */
export function getRecoveryActionLabel(action: RecoveryAction): string {
  switch (action) {
    case RecoveryAction.CLEAR_CACHE:
      return "Clear Cache & Restart";
    case RecoveryAction.RESET_AUTH:
      return "Reset & Log In Again";
    case RecoveryAction.RESTORE_BACKUP:
      return "Restore from Backup";
    case RecoveryAction.CONTACT_SUPPORT:
      return "Contact Support";
    case RecoveryAction.REINSTALL:
      return "Reinstall App";
    default:
      return "Unknown Action";
  }
}
