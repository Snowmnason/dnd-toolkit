/**
 * Service Initialization Status Tracking
 *
 * Tracks the readiness state of all services after bootstrap.
 * Used by kernel and health check systems to understand app capability state.
 *
 * Example:
 *   const status = getServiceStatus();
 *   if (status.database === 'failed') {
 *     showOfflineMode();
 *   }
 */

export type ServiceReadiness = 'ready' | 'degraded' | 'failed' | 'disabled';

export interface ServiceStatus {
  database: ServiceReadiness;
  auth: ServiceReadiness;
  errorTracker: ServiceReadiness;
  analytics: ServiceReadiness;
}

export interface ServiceStatusDetail {
  status: ServiceReadiness;
  provider: string;
  message?: string;
  timestamp: number;
}

/**
 * Internal service status registry
 * Updated during service initialization in service-initializer.ts
 */
const statusRegistry: Map<string, ServiceStatusDetail> = new Map();

/**
 * Record the initialization status of a service
 * @param service - Service name (database, auth, errorTracker, analytics)
 * @param status - Readiness state
 * @param provider - Provider name (supabase, sentry, etc.)
 * @param message - Optional diagnostic message
 */
export function updateServiceStatus(
  service: string,
  status: ServiceReadiness,
  provider: string,
  message?: string
): void {
  statusRegistry.set(service, {
    status,
    provider,
    message,
    timestamp: Date.now(),
  });
}

/**
 * Get the current status of all services
 * @returns Combined status object for all services
 */
export function getServiceStatus(): ServiceStatus {
  return {
    database: statusRegistry.get('database')?.status ?? 'failed',
    auth: statusRegistry.get('auth')?.status ?? 'failed',
    errorTracker: statusRegistry.get('errorTracker')?.status ?? 'failed',
    analytics: statusRegistry.get('analytics')?.status ?? 'failed',
  };
}

/**
 * Get detailed status for a specific service
 * @param service - Service name
 * @returns Detailed status or null if not initialized
 */
export function getServiceStatusDetail(service: string): ServiceStatusDetail | null {
  return statusRegistry.get(service) ?? null;
}

/**
 * Check if a critical service is ready
 * Returns false if service is in 'failed' or 'disabled' state
 */
export function isServiceReady(service: string): boolean {
  const status = statusRegistry.get(service)?.status;
  return status === 'ready' || status === 'degraded';
}

/**
 * Check if all critical services (database, auth) are ready
 * Returns false if any required service failed
 */
export function areCriticalServicesReady(): boolean {
  return isServiceReady('database') && isServiceReady('auth');
}

/**
 * Reset status (for testing)
 * @internal
 */
export function resetServiceStatus(): void {
  statusRegistry.clear();
}

/**
 * Debug: get all service statuses as JSON
 * Useful for health check endpoints and debugging
 */
export function getAllServiceStatuses(): Record<string, ServiceStatusDetail> {
  const result: Record<string, ServiceStatusDetail> = {};
  statusRegistry.forEach((detail, service) => {
    result[service] = detail;
  });
  return result;
}
