/**
 * Phase Executor Constants
 *
 * Hardcoded values that CANNOT be loaded from config because config phase
 * is the first phase. These are minimal and strategic.
 *
 * Everything else (baseMs, network multipliers, baselines) loads from config.
 */

/**
 * Config Phase Hardcoded Timeout
 * 
 * Cannot be loaded from config since config phase is bootstrapping.
 * 3 seconds is generous for a local file load + JSON parse.
 * 
 * If config phase exceeds this timeout:
 * - It will be retried (see CONFIG_PHASE_MAX_RETRIES)
 * - If all retries fail, system enters safe mode or degraded startup
 */
export const CONFIG_PHASE_TIMEOUT_MS = 3000;

/**
 * Config Phase Retry Configuration
 * 
 * If config phase times out or fails, retry this many times.
 * With 2s delay between retries = 6s total retry window.
 */
export const CONFIG_PHASE_MAX_RETRIES = 3;
export const CONFIG_PHASE_RETRY_DELAY_MS = 2000;

/**
 * Type for phase names (used throughout phase executor)
 */
export type PhaseName =
  | "config"
  | "preload"
  | "network"
  | "storage"
  | "services"
  | "jobSetup"
  | "auth"
  | "featureFlags"
  | "registration";

/**
 * Phase sequence for bootstrap execution
 */
export const PHASE_EXECUTION_ORDER: PhaseName[] = [
  "config",
  "preload",
  "network",
  "storage",
  "services",
  "jobSetup",
  "auth",
  "featureFlags",
  "registration",
];
