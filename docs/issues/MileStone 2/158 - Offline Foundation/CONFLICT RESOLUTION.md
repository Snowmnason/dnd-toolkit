# Phase 5: Conflict Resolution UI

## Overview

Phase 5 implements conflict resolution strategies and UI for handling conflicts detected during offline mutation sync. When sync detects a conflict (version mismatch, resource deleted, permission denied), the system applies an automatic resolution strategy or prompts the user to choose.

## Components & Exports

### Conflict Resolution Strategies

**Location**: `lib/offline/conflict-resolution.ts`

Four built-in strategies:

1. **Last-Write-Wins (LWW)** — Compare timestamps, newer version wins
   - Simpler but may lose data
   - Use for low-stakes content
   
2. **Server-Wins** — Always defer to server, discard offline changes
   - Safe but user loses offline work
   - Use for permission-sensitive data (worlds, members)
   
3. **Client-Wins** — Always keep offline changes, override server
   - Preserves user intent but may overwrite newer server data
   - Use for user-owned editable content (notes, characters, shops)
   
4. **User-Chooses** — Defer decision to user via modal
   - Safest but requires UI interaction
   - Use for destructive operations (deletes)

**Exported Functions**:
```typescript
export function resolveLastWriteWins(mutation, conflict, serverTimestamp): ConflictResolutionResult
export function resolveServerWins(mutation, conflict, serverData): ConflictResolutionResult
export function resolveClientWins(mutation, conflict): ConflictResolutionResult
export function resolveUserChoosesRequired(mutation, conflict): ConflictResolutionResult
export function applyUserChoice(choice: 'client-wins'|'server-wins'|'discard', mutation, conflict): ConflictResolutionResult
export function getRecommendedStrategy(operation, resourceType, isUserOwned): Strategy
export function executeConflictResolution(strategy, mutation, conflict, serverData): ConflictResolutionResult
```

### Conflict Queue Hook

**Location**: `lib/offline/use-conflict-queue.ts`

Manages conflicts sequentially (one at a time). Shows modal when conflict needs user input.

**Usage**:
```typescript
import { useConflictQueue } from '@/lib/offline';

const {
  currentConflict,           // Current conflict being displayed
  isVisible,                 // Is modal visible
  enqueueConflict,          // Add conflict to queue
  resolveClientWins,        // User chose to keep offline changes
  resolveServerWins,        // User chose to keep server version
  resolveDiscard,           // User chose to discard offline changes
  cancel,                   // User cancelled without deciding
  conflictCount,            // Total conflicts in queue
} = useConflictQueue();
```

### Conflict Resolution Modal

**Location**: `components/offline/ConflictResolutionModal.tsx`

Displays conflict details and resolution options to user.

**Props**:
```typescript
interface ConflictResolutionModalProps {
  visible: boolean;
  mutation?: QueuedMutation;
  conflict?: SyncConflict;
  resourceType?: string;      // e.g., 'notes', 'characters'
  onClientWins: () => void;   // Keep offline changes
  onServerWins: () => void;   // Keep server version
  onDiscard: () => void;      // Throw away offline changes
  onCancel: () => void;       // Close without deciding
}
```

**Usage**:
```typescript
import { ConflictResolutionModal } from '@/components/offline';
import { useConflictQueue } from '@/lib/offline';

export function MyComponent() {
  const {
    currentConflict,
    isVisible,
    resolveClientWins,
    resolveServerWins,
    resolveDiscard,
    cancel,
  } = useConflictQueue();

  return (
    <ConflictResolutionModal
      visible={isVisible}
      mutation={currentConflict?.mutation}
      conflict={currentConflict?.conflict}
      resourceType={currentConflict?.resourceType}
      onClientWins={resolveClientWins}
      onServerWins={resolveServerWins}
      onDiscard={resolveDiscard}
      onCancel={cancel}
    />
  );
}
```

## Automatic Conflict Resolution

When sync detects a conflict, the system automatically applies the recommended strategy:

- **Destructive operations (delete)** → User-Chooses (requires UI input)
- **User-owned content** (notes, characters, shops) → Client-Wins (preserve intent)
- **Shared/permission-sensitive** (worlds, members) → Server-Wins (safety first)
- **Unknown resources** → Last-Write-Wins (fallback)

### Example Flow

1. User edits a note offline
2. Different edit happens on server
3. Conflict detected during sync
4. Since notes are user-owned → **Client-Wins strategy applied**
5. Offline edit is retried and overwrites server version
6. No user action needed (automatic resolution)

## User-Driven Resolution

When strategy is **User-Chooses**, modal shows three options:

| Option | Effect | Use Case |
|--------|--------|----------|
| **Keep My Changes** | Apply offline mutation (may overwrite server) | User confident in offline edit |
| **Use Server Version** | Discard offline changes, keep server state | User prefers server version |
| **Discard** | Don't apply offline changes at all | User wants to abandon offline edit |

Modal includes warning text for risky operations (e.g., "⚠ May lose data").

## Integration Steps

### 1. Mount Conflict Queue Hook (in app root)

```tsx
import { useConflictQueue } from '@/lib/offline';
import { ConflictResolutionModal } from '@/components/offline';

export function App() {
  const {
    currentConflict,
    isVisible,
    resolveClientWins,
    resolveServerWins,
    resolveDiscard,
    cancel,
  } = useConflictQueue();

  return (
    <>
      {/* Your app content */}
      
      {/* Conflict resolution UI */}
      <ConflictResolutionModal
        visible={isVisible}
        mutation={currentConflict?.mutation}
        conflict={currentConflict?.conflict}
        resourceType={currentConflict?.resourceType}
        onClientWins={resolveClientWins}
        onServerWins={resolveServerWins}
        onDiscard={resolveDiscard}
        onCancel={cancel}
      />
    </>
  );
}
```

### 2. Wire Conflict Queue into Sync Manager

The sync manager automatically calls `enqueueConflict()` when conflicts are detected. This happens in the background — no additional setup needed.

### 3. Sync Manager Behavior

Updated `OnlineSyncManager.syncMutation()` now:
1. Detects conflicts
2. Gets recommended strategy for resource type
3. Auto-applies resolution (client-wins, server-wins, etc.)
4. If strategy is "user-choice" → Enqueues for modal display
5. If strategy is automatic → Applies and continues sync

## Conflict Types

```typescript
enum ConflictType {
  VERSION_MISMATCH = 'version_mismatch',   // Server data is different
  RESOURCE_DELETED = 'resource_deleted',   // Resource deleted on server
  PERMISSION_DENIED = 'permission_denied', // Access revoked
}
```

Each triggers appropriate resolution strategy.

## File Structure

```
lib/offline/
├── conflict-resolution.ts      ← Strategy implementations
├── use-conflict-queue.ts       ← Hook for managing conflicts
├── sync-manager.ts             ← Updated to use conflict resolution
└── index.ts                    ← Exports (updated)

components/offline/
├── ConflictResolutionModal.tsx ← User choice UI
└── index.ts                    ← Exports (updated)
```

## Testing Scenarios

### Scenario 1: Automatic Resolution (Client-Wins)
1. Edit note offline: title = "My Note"
2. Different edit on server: title = "Server Note"
3. Go online → conflict detected
4. Recommended strategy: Client-Wins (notes are user-owned)
5. Result: Offline edit applies, title = "My Note"

### Scenario 2: Automatic Resolution (Server-Wins)
1. Update world name offline: name = "Local World"
2. Different update on server: name = "Server World"
3. Go online → conflict detected
4. Recommended strategy: Server-Wins (worlds are shared)
5. Result: Offline edit discarded, name = "Server World"

### Scenario 3: User Chooses (Destructive)
1. Delete character offline
2. Character also deleted on server (different reason)
3. Go online → conflict detected
4. Recommended strategy: User-Chooses (delete is destructive)
5. Modal shows → user picks option
6. Result depends on user choice

## Known Limitations

- One conflict shown at a time (queued sequentially)
- User must resolve before sync can continue
- No bulk resolution for multiple conflicts
- Can't merge conflicting field-level changes (Phase 6+)

## Future Enhancements (Phase 6+)

- Field-level conflict detection and merging
- Bulk resolution (apply same choice to all similar conflicts)
- Conflict history/audit log
- Visual diff showing what changed locally vs server
- Automatic conflict detection/prevention for collaborative editing
