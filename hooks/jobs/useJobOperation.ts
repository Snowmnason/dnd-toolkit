import {
    JobOperationContextValue,
    useJobOperationContext,
} from '@/providers/JobOperationProvider';

/**
 * useJobOperation
 *
 * Provides access to the JobOperationPanel context.
 * Must be used inside a <JobOperationProvider>.
 *
 * Usage:
 *   const { addJob, updateJob, dismissJob } = useJobOperation();
 */
export function useJobOperation(): JobOperationContextValue {
  return useJobOperationContext();
}
