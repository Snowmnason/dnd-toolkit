/**
 * AppKernel Consumer Hooks
 *
 * Consumer hooks for kernel state. The provider and context live in
 * providers/AppKernelProvider.tsx — these hooks import the context from there.
 *
 * All kernel access goes through lib/kernel (never system/Kernel directly).
 */

import { type AppKernelState } from "@/lib/kernel";
import { AppKernelContext } from "@/providers/AppKernelProvider";
import { useContext } from "react";

/**
 * Hook to access kernel state
 * Must be called within AppKernelProvider
 */
export function useAppKernel(): AppKernelState {
  const state = useContext(AppKernelContext);
  if (state === null) {
    throw new Error("useAppKernel must be called within an AppKernelProvider");
  }
  return state;
}

/**
 * Hook to check if app is ready (shorthand)
 */
export function useAppReady(): boolean {
  const kernel = useAppKernel();
  return kernel.phases.appReady;
}

/**
 * Hook to check if a specific phase is ready
 * Type-safe: TypeScript enforces phase must be a valid key of AppKernelState['phases']
 */
export function usePhaseReady(phase: keyof AppKernelState["phases"]): boolean {
  const kernel = useAppKernel();
  // eslint-disable-next-line security/detect-object-injection
  return kernel.phases[phase];
}
