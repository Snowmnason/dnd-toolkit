/**
 * Condition evaluators for feature flags
 *
 * Provides context-aware evaluation of flag conditions (platform, environment, userRole).
 * Used by FeatureFlagsManager.isEnabledWithContext() to determine if a flag should be enabled
 * based on the current runtime context.
 */

import { getAppConfig } from "../config/loader";
import { getPlatformName } from "../config/platform-config";
import { FeatureFlagsManager } from "./server-sync";

// ==========================================
// Types
// ==========================================

/**
 * Context passed to isEnabledWithContext() to evaluate flag conditions
 */
export interface FlagContext {
  platform?: string; // 'web' | 'ios' | 'android' | 'desktop'
  environment?: string; // 'development' | 'production'
  userRole?: string; // Role name (e.g., 'admin', 'moderator')
}

/**
 * Flag condition schema from AppSettings
 */
export interface FlagConditions {
  platform?: string;
  environment?: string;
  userRole?: string;
}

// ==========================================
// Evaluators
// ==========================================

/**
 * Check if a platform condition is satisfied
 * @param requiredPlatform Platform name from condition (e.g., 'web')
 * @param currentPlatform Platform from context or detected
 * @returns true if condition is satisfied or not specified
 */
export function matchPlatform(
  requiredPlatform: string | undefined,
  currentPlatform: string,
): boolean {
  if (!requiredPlatform) return true; // No condition = always match
  return currentPlatform.toLowerCase() === requiredPlatform.toLowerCase();
}

/**
 * Check if an environment condition is satisfied
 * @param requiredEnvironment Environment name from condition (e.g., 'production')
 * @param currentEnvironment Environment from context or config
 * @returns true if condition is satisfied or not specified
 */
export function matchEnvironment(
  requiredEnvironment: string | undefined,
  currentEnvironment: string,
): boolean {
  if (!requiredEnvironment) return true; // No condition = always match
  return (
    currentEnvironment.toLowerCase() === requiredEnvironment.toLowerCase()
  );
}

/**
 * Check if a userRole condition is satisfied
 * @param requiredRole Role from condition (e.g., 'admin')
 * @param currentRole User's role from context (cached or computed)
 * @returns true if condition is satisfied or not specified
 */
export function matchUserRole(
  requiredRole: string | undefined,
  currentRole: string | undefined,
): boolean {
  if (!requiredRole) return true; // No condition = always match
  if (!currentRole) return false; // Condition requires a role but none provided
  return currentRole.toLowerCase() === requiredRole.toLowerCase();
}

/**
 * Evaluate all conditions for a flag against the provided context
 * Uses AND logic: all conditions must be satisfied for evaluation to pass
 *
 * @param conditions Flag conditions from schema
 * @param context Provided runtime context
 * @returns true if all conditions are satisfied, false if any condition fails
 */
export function evaluateConditions(
  conditions: FlagConditions | undefined,
  context: FlagContext,
): boolean {
  if (!conditions) return true; // No conditions = always match

  // Default to current platform and environment if not provided
  const currentPlatform = context.platform || getPlatformName();
  const currentEnvironment = context.environment || getAppConfig().environment;

  // Check each condition; AND logic (all must pass)
  if (!matchPlatform(conditions.platform, currentPlatform)) {
    return false;
  }

  if (!matchEnvironment(conditions.environment, currentEnvironment)) {
    return false;
  }

  if (!matchUserRole(conditions.userRole, context.userRole)) {
    return false;
  }

  return true;
}

/**
 * Get a user's role from cached entitlements or session
 * Phase 2: Reads from cached entitlements populated at bootstrap
 * Fallback: Returns "unknown" if role data unavailable
 *
 * **How it works:**
 * - Phase 1: Returns undefined (caller provides role in context)
 * - Phase 2: Queries FeatureFlagsManager for cached role data (if available)
 * - Fallback: Returns "unknown" (safe for permission checks)
 *
 * See: FeatureFlagsManager.getCachedUserRole() for actual implementation
 *
 * @returns User's role (e.g., 'admin') or "unknown" if unavailable
 */
export function getCachedUserRole(): string {
  // Phase 2: Query FeatureFlagsManager for cached role from entitlements
  return FeatureFlagsManager.getCachedUserRole();
}
