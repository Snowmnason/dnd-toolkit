/**
 * Edge Functions Module - README
 *
 * Central abstraction layer for edge functions (stored procedures, RPC calls, Cloud Functions, etc.)
 *
 * This module provides a semantic, backend-agnostic interface for running edge functions.
 * Instead of tightly coupling your code to Supabase `.rpc()` calls, you use a registry-based
 * pattern that supports swapping backends at runtime.
 *
 * See ../database/edge/ for the canonical implementation location.
 */

# Edge Functions Abstraction

## Overview

The edge functions module abstracts stored procedures and RPC calls behind a semantic interface, allowing you to:

- **Swap backends** without changing call sites (Supabase RPC → Firebase Cloud Functions → custom Node.js → etc.)
- **Register implementations** dynamically at runtime
- **Add type safety** for inputs/outputs of each function
- **Build testable code** with mock implementations

## Architecture

```
lib/database/edge/
├── constants.ts         ← Edge function URL paths (Supabase-specific)
├── registry.ts          ← Core registry, function implementations, execute function
├── index.ts             ← Barrel export
└── [future] implementations/
    └── supabase-rpc-adapter.ts   ← Supabase RPC mapper

lib/database/repositories/
└── supabase-rpc-adapter.ts ← Supabase-specific: maps semantic names to RPC procedures
                            (alternative location: could move to lib/database/edge/implementations/)

lib/edge-functions/
└── index.ts             ← Compatibility shim, re-exports from lib/database/edge/
```

## How to Use

### Call an Edge Function

```typescript
import { executeEdgeFunction } from "@/lib/database/edge";

// Execute a registered edge function
const result = await executeEdgeFunction('leaveWorld', {
  world_id: '123'
});
```

### Use the Semantic RPC Adapter

```typescript
import { runEdgeFunction } from "@/lib/database/repositories/supabase-rpc-adapter";

// Direct semantic call to Supabase RPC (no registration needed)
const result = await runEdgeFunction('createInviteLink', {
  world_id: '123',
  expires_in_days: 7
});
```

### Register an Implementation

```typescript
import { registerEdgeFunction, type EdgeFunctionImplementation } from "@/lib/database/edge";

// Register a custom implementation
const customImpl: EdgeFunctionImplementation = {
  name: 'leaveWorld',
  handler: async (input) => {
    // Your custom backend call here
    return { success: true };
  }
};

registerEdgeFunction('leaveWorld', customImpl);
```

## Current Edge Functions

All semantic names are camelCase. Supabase RPC procedures (snake_case) are mapped automatically.

| Semantic Name | Supabase Procedure | Input | Output | Purpose |
|---|---|---|---|---|
| `createInviteLink` | `create_invite_link` | `{ world_id, expires_in_days?, max_uses? }` | `{ invite_token, invite_code, expires_at }` | Create a shareable invite link for a world |
| `resolveInviteToken` | `resolve_invite_token` | `{ invite_token }` | `{ world_id, world_name, created_by_user_id, created_by_name }` | Validate and get details about an invite |
| `deleteInviteLink` | `delete_invite_link` | `{ invite_token }` | `{ success, message? }` | Revoke an invite link |
| `joinWorldWithInvite` | `join_world_with_invite` | `{ invite_token }` | `{ world_id, user_world_id, ... }` | Accept an invite and join a world |
| `leaveWorld` | `leave_world` | `{ world_id }` | `{ success, message? }` | Leave a world (not currently used, but available) |
| `removeWorldAccess` | `remove_world_access` | `{ world_id, user_id }` | `{ success, message? }` | Remove a user from a world (admin/owner action) |

## Implementing a New Backend

To add support for a new backend (Firebase Cloud Functions, AWS Lambda, Node.js, etc.):

### 1. Create an Adapter

```typescript
// lib/database/edge/implementations/firebase-cloud-functions-adapter.ts

import { type EdgeFunctionImplementation } from "../registry";

export function createFirebaseAdapter<Input, Output>(
  functionName: string
): EdgeFunctionImplementation<Input, Output> {
  return {
    name: functionName,
    handler: async (input: Input) => {
      // Call Firebase Cloud Function
      const response = await fetch(
        `https://us-central1-project.cloudfunctions.net/${functionName}`,
        { method: 'POST', body: JSON.stringify(input) }
      );
      return response.json();
    }
  };
}
```

### 2. Register All Functions

```typescript
// During app initialization (e.g., in kernel/app-kernel.ts)

import { registerEdgeFunction } from "@/lib/database/edge";
import { createFirebaseAdapter } from "@/lib/database/edge/implementations/firebase-cloud-functions-adapter";

const edgeFunctions = [
  'createInviteLink',
  'resolveInviteToken',
  'deleteInviteLink',
  'joinWorldWithInvite',
  'leaveWorld'
];

edgeFunctions.forEach(fn => {
  const adapter = createFirebaseAdapter(fn);
  registerEdgeFunction(fn, adapter);
});
```

### 3. Use in Code (No Changes Needed)

Code that calls `executeEdgeFunction()` works without any modifications:

```typescript
// This works with Supabase, Firebase, or any registered backend
const result = await executeEdgeFunction('createInviteLink', {
  world_id: '123',
  expires_in_days: 7
});
```

## API Reference

### `registerEdgeFunction(name, impl)`

Register an edge function implementation.

```typescript
function registerEdgeFunction<Input, Output>(
  name: string,
  impl: EdgeFunctionImplementation<Input, Output>
): void
```

### `executeEdgeFunction(name, input)`

Execute a registered edge function.

```typescript
async function executeEdgeFunction<Output = any>(
  name: string,
  input: any
): Promise<Output>
```

### `getEdgeFunction(name)`

Get a registered implementation (throws if not found).

```typescript
function getEdgeFunction<Input = any, Output = any>(
  name: string
): EdgeFunctionImplementation<Input, Output>
```

### `runEdgeFunction(name, input)`

Direct call to Supabase RPC (from `supabase-rpc-adapter.ts`). No registration needed.

```typescript
async function runEdgeFunction<T extends EdgeFunctionOutput = any>(
  functionName: string,
  input: EdgeFunctionInput
): Promise<T>
```

### `isEdgeFunctionRegistered(name)`

Check if a function is registered.

```typescript
function isEdgeFunctionRegistered(name: string): boolean
```

### `getRegisteredEdgeFunctions()`

Get all registered function names (useful for debugging).

```typescript
function getRegisteredEdgeFunctions(): string[]
```

### `clearEdgeFunctionRegistry()`

Clear all registrations. **Use with caution** — only for testing or complete provider swaps.

```typescript
function clearEdgeFunctionRegistry(): void
```

## Error Handling

Edge functions throw on failure. Wrap calls in try/catch:

```typescript
try {
  const result = await executeEdgeFunction('createInviteLink', { world_id: '123' });
} catch (err) {
  if (err instanceof Error) {
    console.error('Failed:', err.message);
  }
}
```

## Testing

### Mock an Implementation

```typescript
import { registerEdgeFunction, clearEdgeFunctionRegistry } from "@/lib/database/edge";

// In your test setup:
beforeEach(() => {
  clearEdgeFunctionRegistry();

  // Register mocks
  registerEdgeFunction('createInviteLink', {
    name: 'createInviteLink',
    handler: async () => ({
      invite_token: 'mock-token',
      invite_code: 'ABC123',
      expires_at: '2026-12-31T00:00:00Z'
    })
  });
});

afterEach(() => {
  clearEdgeFunctionRegistry();
});
```

### Integration Testing

Use the real Supabase adapter in integration tests:

```typescript
import { runEdgeFunction } from "@/lib/database/repositories/supabase-rpc-adapter";

// This calls real Supabase RPC (requires valid auth)
const result = await runEdgeFunction('createInviteLink', {
  world_id: testWorldId,
  expires_in_days: 7
});

expect(result.invite_token).toBeDefined();
```

## Future Enhancements

- [ ] Add Firebase Cloud Functions adapter
- [ ] Add AWS Lambda adapter
- [ ] Add retry/circuit-breaker logic to registry
- [ ] Add metrics/tracing to each edge function call
- [ ] Build dashboard for edge function monitoring

## Related Modules

- **`lib/database/repositories/`** — Repository pattern for database queries (similar abstraction principle)
- **`lib/services/auth-provider/`** — Auth provider abstraction (same pattern, different domain)
- **`lib/database/edge/constants.ts`** — Edge function URL constants (Supabase-specific)
- **`lib/database/invites.ts`**, **`lib/database/worlds.ts`** — Call sites that use edge functions

## See Also

- [Edge Function Architecture](../../Tier%202/TIER_2_OVERVIEW.md)
- [Database Provider Abstraction](../../Tier%202/Tier%205/255-Database%20Provider%20Abstraction/ARCHITECTURE.md)
- [Semantic Repository Pattern Issue #261-Lite](../256-Lite-Semantic%20Repository%20Pattern%20%26%20True%20Database%20Abstraction.md)
