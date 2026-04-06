/**
 * Job Operation Types
 *
 * Defines the data structures for user-initiated job tracking in the JobOperationPanel.
 * This is used by the job queue to communicate with the UI layer about operation progress.
 */

/**
 * Represents a single user-initiated operation (upload, download, background job)
 *
 * - `id`: Unique identifier for this operation
 * - `title`: Short display name (e.g., "profile.jpg", "Sync World Data")
 * - `type`: Operation category for color coding and filtering
 * - `status`: Current state of the operation
 * - `progress`: 0-100 percentage (0 when pending/spinning)
 * - `error`: Optional error message (short, <1 sentence), truncated at render time
 * - `onCancel`: Callback to cancel the operation (if still cancellable)
 * - `onRetry`: Callback to retry the operation (if failed)
 * - `isUserInitiated`: Flag indicating this is user-visible vs background task
 */
export interface JobOperation {
  id: string;
  title: string;
  type: 'upload' | 'download' | 'background-job';
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number; // 0-100
  error?: string;
  onCancel?: () => void | Promise<void>;
  onRetry?: () => void | Promise<void>;
  isUserInitiated: boolean;
}

/**
 * Job Operation Provider State
 *
 * Manages all active/pending operations and UI state for the JobOperationPanel
 */
export interface JobOperationProviderState {
  jobs: JobOperation[];
  isExpanded: boolean;
  autoExpandEnabled: boolean;
}

/**
 * Job Operation Update Payload
 *
 * Used when updating an existing job's properties
 */
export type JobOperationUpdate = Partial<
  Omit<JobOperation, 'id' | 'type' | 'isUserInitiated'>
>;

/**
 * Color token names for each job type.
 * Use with $() or theme[token] to resolve the actual color value.
 */
export const JOB_TYPE_COLOR_TOKENS = {
  upload: 'JobUpload',
  download: 'JobDownload',
  'background-job': 'JobBackground',
} as const satisfies Record<JobOperation['type'], string>;
