import type { DegradeCapability } from "@/type-definitions/degrade";

/**
 * Represents a single failed registration item
 */
export interface RegistrationFailure {
  item: string;
  error: string;
  requiredCapability: DegradeCapability;
  recoverable: boolean;
}

/**
 * Result of the registration phase
 */
export interface RegistrationResult {
  success: boolean; // true if all critical items registered
  registered: string[];
  skipped: string[];
  failed: RegistrationFailure[];
  failuresSummary?: string; // Human-readable summary of failures for UI display
}
