import type { KernelError } from '@/lib/kernel/kernel-manager';
import { getKernelState, onKernelStateChange } from '@/lib/kernel/kernel-manager';
import { useEffect, useState } from 'react';

/**
 * Hook to monitor kernel errors during bootstrap
 * Returns the current kernel error (if any)
 */
export function useKernelError() {
  const [error, setError] = useState<KernelError | null>(() => {
    return getKernelState().error;
  });

  useEffect(() => {
    const unsubscribe = onKernelStateChange((state) => {
      setError(state.error);
    });
    return unsubscribe;
  }, []);

  return error;
}
