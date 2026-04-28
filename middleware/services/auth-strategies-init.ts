/**
 * Auth Strategies Initializer — thin bootstrap-only file
 *
 * Intentionally minimal deps. Called during the services phase of bootstrap
 * (system/Services/service-initializer.ts). Isolated here so that loading
 * this file does NOT pull in the full auth-service.ts module graph
 * (NetworkDetection, degrade-manager, AppError, system/Services barrel, etc.)
 * which would add ~1000ms to the services phase cold-load.
 *
 * Only dynamic imports are used so Metro can tree-shake each bundle chunk.
 */

import { logger } from '@/lib/utils/logger';

/**
 * Register auth strategies (user, public, invite) with AuthLayer.
 * Called once during bootstrap after the auth provider is registered.
 * Safe to call multiple times — clears existing strategies before re-registering.
 */
export async function initializeAuthStrategies(): Promise<void> {
    const [{ AuthLayer }, { createUserAuthStrategy, createPublicAuthStrategy, createInviteAuthStrategy }] = await Promise.all([
        import('@/lib/auth/auth-layer'),
        import('@/lib/auth/default-strategies'),
    ]);

    // Clear existing strategies first to support idempotent re-initialization
    // (e.g., React error boundary remount, HMR, or kernel retry)
    AuthLayer.clearAuthStrategies();

    AuthLayer.registerAuthStrategy('user', createUserAuthStrategy());
    AuthLayer.registerAuthStrategy('public', createPublicAuthStrategy());
    AuthLayer.registerAuthStrategy('invite', createInviteAuthStrategy());

    logger.category('bootstrap').info('Auth strategies registered: user, public, invite');
}
