/**
 * Phase 0: Config Phase (CRITICAL)
 * 
 * Responsibility: Load and validate application configuration
 * Called by: system/Kernel/app-kernel.ts
 * 
 * Timing: ~10-50ms, max 500ms (defined in app-kernel)
 * Critical: YES — blocks all subsequent phases
 * Failure mode: Throws error; blocks app startup
 * 
 * Does:
 * 1. Load application config (appsettings.json)
 * 2. Validate configuration completeness
 * 3. Provide validated config for downstream phases
 *
 * Enables: ALL subsequent phases depend on this completing first
 */

/**
 * Execute config phase
 * 
 * Loads and validates application configuration. Throws if validation fails
 * (critical blocker — app cannot proceed without valid config).
 * 
 * @param state - Mutable kernel state
 * @throws Error if config validation fails (critical)
 */
export async function configPhase(signal: AbortSignal): Promise<void> {
  try {
    if (signal.aborted) return;
    // Load config system
    const { getAppConfig, validateConfig, logValidationResults } =
      await import('@/config');

    // Get and validate config
    const config = getAppConfig();
    const configValidation = validateConfig(config);
    logValidationResults(configValidation);

    // Fail if config is invalid (critical)
    if (!configValidation.valid) {
      throw new Error(
        `Configuration validation failed: ${configValidation.errors.join("; ")}`,
      );
    }
  } catch (error) {
    const { reportConfigBootstrapCrash } = await import(
      '@/system/Degrade/handlers/crash-handlers'
    );
    reportConfigBootstrapCrash(String(error));
    throw error;
  }
}
