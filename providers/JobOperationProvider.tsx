import {
    JobOperation,
    JobOperationUpdate,
} from '@/type-definitions/';
import React, { createContext, useCallback, useContext, useState } from 'react';

// ─────────────────────────────────────────────
// Context Value shape
// ─────────────────────────────────────────────

export interface JobOperationContextValue {
  /** All user-initiated jobs in FIFO order */
  jobs: JobOperation[];
  /** Whether the panel accordion is open */
  isExpanded: boolean;
  /** Number of currently active or pending jobs */
  activeCount: number;
  /** True when any jobs are present */
  hasJobs: boolean;
  /** True when any job is active or pending */
  hasActiveJobs: boolean;

  /** Add a new job to the list (non-userInitiated jobs are silently ignored) */
  addJob: (job: JobOperation) => void;
  /** Merge partial updates into an existing job by id */
  updateJob: (id: string, updates: JobOperationUpdate) => void;
  /** Remove a job from the list by id */
  removeJob: (id: string) => void;
  /** Call onCancel() on the job then remove it */
  cancelJob: (id: string) => void;
  /** Alias for removeJob — used on completed/error items */
  dismissJob: (id: string) => void;
  /** Dismiss all jobs from the list */
  dismissAll: () => void;
  /** Manually open or close the panel accordion */
  setExpanded: (expanded: boolean) => void;
}

// ─────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────

const JobOperationContext = createContext<JobOperationContextValue | undefined>(
  undefined,
);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

interface JobOperationProviderProps {
  children: React.ReactNode;
}

export function JobOperationProvider({ children }: JobOperationProviderProps) {
  // Only user-initiated jobs. FIFO order.
  const [jobs, setJobs] = useState<JobOperation[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  // autoExpandEnabled tracks whether the panel should auto-open on the NEXT new job.
  // Once the user manually collapses the panel, this is set to false permanently.
  const [autoExpandEnabled, setAutoExpandEnabled] = useState(true);

  const addJob = useCallback((job: JobOperation) => {
    if (!job.isUserInitiated) return;

    setJobs((prev) => [...prev, job]);
    setIsExpanded((prevExpanded) => {
      // Auto-expand only if enabled (user has not manually collapsed)
      if (autoExpandEnabled) {
        setAutoExpandEnabled(true); // Keep it enabled until user collapses
        return true;
      }
      return prevExpanded;
    });
  }, [autoExpandEnabled]);

  const updateJob = useCallback((id: string, updates: JobOperationUpdate) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...updates } : job)),
    );
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const cancelJob = useCallback((id: string) => {
    setJobs((prev) => {
      const target = prev.find((job) => job.id === id);
      if (target?.onCancel) {
        // Fire-and-forget — caller is responsible for any error handling
        void Promise.resolve(target.onCancel());
      }
      return prev.filter((job) => job.id !== id);
    });
  }, []);

  const dismissJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setJobs([]);
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    if (!expanded) {
      // User manually collapsed — disable auto-expand for future jobs
      setAutoExpandEnabled(false);
    }
  }, []);

  const activeCount = jobs.filter(
    (j) => j.status === 'active' || j.status === 'pending',
  ).length;

  const value: JobOperationContextValue = {
    jobs,
    isExpanded,
    activeCount,
    hasJobs: jobs.length > 0,
    hasActiveJobs: activeCount > 0,
    addJob,
    updateJob,
    removeJob,
    cancelJob,
    dismissJob,
    dismissAll,
    setExpanded,
  };

  return (
    <JobOperationContext.Provider value={value}>
      {children}
    </JobOperationContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Internal hook (used only by useJobOperation)
// ─────────────────────────────────────────────

export function useJobOperationContext(): JobOperationContextValue {
  const ctx = useContext(JobOperationContext);
  if (!ctx) {
    throw new Error(
      'useJobOperation must be used within a <JobOperationProvider>',
    );
  }
  return ctx;
}
