# Job Operations UI

The **JobOperationPanel** is a Google Drive-style operation tracker that displays user-initiated jobs (uploads, downloads, background tasks) in a collapsible accordion anchored to the bottom-right (desktop) or bottom (mobile).

## Overview

| Aspect | Details |
|--------|---------|
| **Purpose** | User-visible job tracking for long-running manual operations |
| **Scope** | Manual user-initiated jobs only (NOT background sync or system jobs) |
| **Display** | Job list with status indicators, progress, and action buttons |
| **Positioning** | Bottom-right corner (desktop), bottom overlay (mobile) |
| **Expansion** | Accordion expands upward from header; auto-collapses if no active jobs |
| **Entry point** | `<JobOperationLayer>` + `useJobOperation()` hook |

---

## Job Lifecycle (Brief Overview)

```
pending (user clicked "Upload") 
  → active (uploading..., progress bar shows %)
    → completed ✓ (done) or error ✗ (failed)
      → dismissed (user clicked "Dismiss" or auto-cleared)
```

Each job displays:
- **Status icon** — Spinner (pending), progress bar (active), checkmark (completed), alert (error)
- **Job label** — Human-readable name (e.g., "Uploading map.txt")
- **Progress** — Percentage (only while active)
- **Buttons** — Cancel/Dismiss/Retry (context-specific)

---

## UI Structure

### JobOperationPanel

The main accordion container. Renders list of jobs.

```tsx
<Accordion
  title={`Operations (${jobs.length})`}  // "Operations — Done (3)" if all completed
  open={isExpanded}
  onToggle={handleToggle}
  reversed  // Expands upward from bottom
>
  {/* Job list here */}
</Accordion>
```

### JobOperationItem

Single row per job. Shows:
- Left colored border (type-based color: upload=blue, download=green, etc.)
- Status icon (spinner/progress/checkmark/alert)
- Job label + optional progress %
- Action buttons (Cancel/Dismiss/Retry)

```
┌─ [●] | Uploading map data | [Cancel] ─┐
├─ [◐] | Processing images | 45% [Cancel] ─┤
├─ [✓] | Upload complete | [Dismiss] ─┤
└─ [⚠] | Failed: Network error | [Retry][Dismiss] ─┘
```

Error messages:
- **On hover** (desktop) → Tooltip shows full error text
- **On mobile** → *(TODO)* Tap-to-expand or long-press toast *(not yet implemented)*

### Scrolling

If more than 4 jobs:
- Panel becomes scrollable internally
- Max height: 6× spacing unit (responsive)
- Scrollbar hidden on web

---

## Integration: Adding a Job to Your Feature

When you want to track a user operation (upload, download, sync), follow this pattern:

### Step 1: Import the hook

```tsx
import { useJobOperation } from '@/hooks/jobs/useJobOperation';
```

### Step 2: Call `addJob()` when user initiates action

```tsx
export function MapUploadButton() {
  const { addJob, updateJob } = useJobOperation();

  const handleUpload = async () => {
    const jobId = crypto.randomUUID();

    // Create the job
    addJob({
      id: jobId,
      type: 'JobUpload',  // or 'JobDownload', 'JobBackground'
      status: 'pending',
      label: 'Uploading map file',
      progress: 0,
      isUserInitiated: true,
      onCancel: async () => { /* abort upload */ },
      onRetry: async () => { /* retry upload */ },
    });

    try {
      // Start actual upload
      const file = await selectFile();
      
      // Update to active
      updateJob(jobId, { status: 'active' });

      // Track progress
      await uploadWithProgress(file, (percent) => {
        updateJob(jobId, { progress: percent });
      });

      // Mark complete
      updateJob(jobId, { status: 'completed' });
    } catch (error) {
      // Mark error
      updateJob(jobId, {
        status: 'error',
        error: error.message,  // Stored fully, truncated at render
      });
    }
  };

  return <Button onPress={handleUpload}>Upload Map</Button>;
}
```

### Step 3: Panel auto-manages UI

Once you call `addJob()`:
- ✅ Panel opens automatically (if user hasn't manually collapsed it)
- ✅ Job appears in the list
- ✅ Status icon updates as you call `updateJob()`
- ✅ Buttons (Cancel/Dismiss/Retry) handle user interactions
- ✅ Job auto-removes when user presses Dismiss

---

## Job Configuration

### JobOperation Type

```tsx
interface JobOperation {
  id: string;                      // Unique ID (UUID recommended)
  type: 'JobUpload' | 'JobDownload' | 'JobBackground';  // Determines icon color
  status: 'pending' | 'active' | 'completed' | 'error';
  label: string;                   // Human-readable: "Uploading map.txt"
  progress: number;                // 0-100 (only used when status='active')
  error?: string;                  // Error message (shown on hover)
  isUserInitiated: boolean;         // MUST be true to show in panel
  onCancel?: () => Promise<void>;   // Called when user clicks [Cancel]
  onRetry?: () => Promise<void>;    // Called when user clicks [Retry]
}
```

### Job Status Visual Map

| Status | Icon | Buttons | Example |
|--------|------|---------|---------|
| `pending` | Spinner | [Cancel] | Job queued, waiting to start |
| `active` | Circular progress bar | [Cancel] | Uploading (shows %) |
| `completed` | Green checkmark | [Dismiss] | Done successfully |
| `error` | Red alert | [Retry] [Dismiss] | Something went wrong |

---

## Error Handling (Brief)

### Storing Errors

```tsx
updateJob(jobId, {
  status: 'error',
  error: 'Network timeout: Could not reach server',  // Keep <1 sentence
});
```

### User Actions on Error

- **[Retry]** → Calls `job.onRetry()`, then removes the job (caller decides to re-add)
- **[Dismiss]** → Removes the job from the panel

### Design Pattern

Keep error messages actionable and brief:
- ✅ "Network timeout: Check your connection"
- ✅ "File too large (>1GB)"
- ❌ "Error code E_UPLOAD_FAILED_UNKNOWN_REASON"

---

## Hook API

### useJobOperation()

Access and control the job panel.

```tsx
const {
  jobs,           // Array of all current jobs
  isExpanded,     // Panel accordion open/closed
  activeCount,    // Number of pending/active jobs
  hasJobs,        // true if jobs.length > 0
  hasActiveJobs,  // true if activeCount > 0
  
  // Actions
  addJob,         // Add a new job
  updateJob,      // Update one job (merge partial updates)
  removeJob,      // Remove job from list
  cancelJob,      // Call job.onCancel(), then remove
  dismissJob,     // Alias for removeJob
  setExpanded,    // Manually open/close panel (disables auto-expand if closed)
} = useJobOperation();
```

### Example: Complete Workflow

```tsx
export function FileDownloadButton() {
  const { addJob, updateJob } = useJobOperation();

  const handleDownload = async () => {
    const jobId = crypto.randomUUID();
    let abortController = new AbortController();

    addJob({
      id: jobId,
      type: 'JobDownload',
      status: 'pending',
      label: 'Preparing download...',
      progress: 0,
      isUserInitiated: true,
      onCancel: async () => {
        abortController.abort();
      },
      onRetry: async () => {
        // Caller decides what to do; panel removes job
        // Usually: re-add the job and retry
        handleDownload();
      },
    });

    try {
      updateJob(jobId, { status: 'active', label: 'Downloading...' });

      await downloadFile(jobId, {
        signal: abortController.signal,
        onProgress: (percent) => {
          updateJob(jobId, { progress: percent });
        },
      });

      updateJob(jobId, {
        status: 'completed',
        label: 'Download complete',
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        // User cancelled — panel will call dismissJob() automatically
        return;
      }
      updateJob(jobId, {
        status: 'error',
        error: error.message,
      });
    }
  };

  return <Button onPress={handleDownload}>Download</Button>;
}
```

---

## Expected Behavior

### Panel Auto-Open
When you add a job and the panel is in auto-expand mode:
```tsx
addJob({...});  // → Panel opens automatically ✅
```

### Manual Collapse Disables Auto-Expand
Once user manually collapses the panel:
```tsx
setExpanded(false);  // User manually closes
addJob({...});       // → Panel stays closed (auto-expand disabled)
```

To re-enable auto-expand:
```tsx
setExpanded(true);   // User opens again
// Next addJob will auto-open again
```

### Job Removal on Completion
Users dismiss completed jobs manually:
```tsx
updateJob(jobId, { status: 'completed' });  // Job shows checkmark
// User clicks [Dismiss] → dismissJob(jobId) called → job removed from list
```

### Error Display
Errors persist until user action:
```tsx
updateJob(jobId, {
  status: 'error',
  error: 'Upload failed: 403 Forbidden',
});
// Panel shows alert icon + truncated label
// Hover (desktop) → Tooltip with full error
// Click [Retry] or [Dismiss] → job removed
```

---

## Positioning & Z-Index

- **JobOperationPanel renders in:** `<JobOperationLayer>` (a floating overlay)
- **Z-index:** 1100 (above most UI, below full-screen modals)
- **Desktop:** Anchored to bottom-right corner, 20px from edges
- **Mobile:** Anchored to bottom, full width with horizontal margins
- **Safe-area aware:** Respects notches and bottom bars

---

## Platform-Specific Notes

### Desktop (Web)
- Docked to bottom-right
- Panel expands upward to avoid going off-screen
- Hover tooltips show full error messages
- No scrollbar visible (cleaned up with `showsVerticalScrollIndicator={false}`)

### Mobile (Native)
- Panel anchored to bottom of screen
- May overlap with native bottom tab bar (design choice)
- *(TODO)* Touch-friendly error display (currently desktop-only tooltip)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Job doesn't appear | Check `isUserInitiated === true` on the job |
| Job is visible but stuck | Set `status` to `'completed'` or `'error'` to show progress as done |
| Error message truncated | Hover (desktop) or wait for mobile fix; keep errors <1 sentence |
| Panel won't open | User manually collapsed; call `setExpanded(true)` to re-enable auto-expand |
| Buttons don't respond | Ensure `onCancel`/`onRetry` are async functions, not undefined |
| Duplicates in list | Use unique `id` per job; check you're not calling `addJob()` multiple times |

---

## Future Enhancements

- Mobile error tooltips / tap-to-expand inline view
- Job persistence across navigations (save to storage)
- Batch operations (pause all, resume all)
- Job filtering (show only uploads, show only errors)
- Custom job types beyond Upload/Download/Background
