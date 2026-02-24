# Usage Guide: Semantic Repository Pattern

**Issue:** #261-Lite  
**Context:** Semantic Repository Pattern & True Database Abstraction

## Overview

This guide shows how to use the new repository-based architecture in application code. The repository pattern abstracts database operations behind semantic interfaces, making your code backend-agnostic and easier to test.

## Core Concepts

### Repository Pattern

Instead of calling database providers directly, use semantic repositories:

```typescript
// ❌ Old way: Direct database calls
const user = await getDatabaseProvider()
  .from('users')
  .select('*')
  .eq('auth_id', authId)
  .single();

// ✅ New way: Semantic repository
const user = await getUserRepository().getByAuthId(authId);
```

### Registry-Based Discovery

Repositories are registered at startup and discovered at runtime:

```typescript
// Registration (happens at app startup)
registerRepository('user', new SupabaseUserRepository());

// Usage (in your components/hooks)
const userRepo = getUserRepository();
const user = await userRepo.getById(userId);
```

## Repository APIs

### UserRepository

```typescript
import { getUserRepository } from '@/lib/database/repositories';

const userRepo = getUserRepository();

// Get user by ID
const user = await userRepo.getById('user-123');

// Get user by auth ID (common after login)
const user = await userRepo.getByAuthId('auth-uuid');

// Create new user profile
const newUser = await userRepo.create({
  authId: 'auth-uuid',
  username: 'john_doe'
});

// Update user profile
const updatedUser = await userRepo.update('user-123', {
  username: 'new_username'
});
```

### WorldRepository

```typescript
import { getWorldRepository } from '@/lib/database/repositories';

const worldRepo = getWorldRepository();

// Create a new world
const world = await worldRepo.create({
  name: 'Forgotten Realms',
  system: 'dnd5e',
  isDm: true
});

// Get world by ID with access info
const world = await worldRepo.getById('world-123');
// Returns: { id, name, system, userRole: 'dm' | 'player' | ... }

// Get all worlds user has access to
const worlds = await worldRepo.getAccessibleWorlds('user-123');

// Update world details (owner only)
const updated = await worldRepo.update('world-123', {
  name: 'Updated Name'
});

// Delete world (owner only)
await worldRepo.delete('world-123');
```

### WorldAccessRepository

```typescript
import { getWorldAccessRepository } from '@/lib/database/repositories';

const accessRepo = getWorldAccessRepository();

// Grant user access to world
await accessRepo.addUser('world-123', 'user-456', 'player');

// Update user's role in world
await accessRepo.updateUserRole('world-123', 'user-456', 'gm');

// Remove user from world
await accessRepo.removeUser('world-123', 'user-456');

// Get all members of a world
const members = await accessRepo.getMembers('world-123');
```

### InviteRepository

```typescript
import { getInviteRepository } from '@/lib/database/repositories';

const inviteRepo = getInviteRepository();

// Create invite link
const invite = await inviteRepo.create({
  worldId: 'world-123',
  expiresInDays: 7,
  maxUses: 10
});

// Validate invite token
const validation = await inviteRepo.validate('invite-token-abc');
// Returns: { isValid: true, worldId: 'world-123' } | { isValid: false, error: '...' }

// Delete invite link
await inviteRepo.delete('invite-token-abc');

// Get all invites for a world
const invites = await inviteRepo.getByWorldId('world-123');
```

### UserSettingsRepository

```typescript
import { getUserSettingsRepository } from '@/lib/database/repositories';

const settingsRepo = getUserSettingsRepository();

// Get user settings
const settings = await settingsRepo.get('user-123');

// Update settings
await settingsRepo.update('user-123', {
  theme: 'dark',
  notifications: true
});
```

### FeatureFlagsRepository

```typescript
import { getFeatureFlagsRepository } from '@/lib/database/repositories';

const flagsRepo = getFeatureFlagsRepository();

// Get all feature flags
const flags = await flagsRepo.getAll();

// Check if feature is enabled
const isEnabled = await flagsRepo.isEnabled('new_feature');
```

### EntitlementsRepository

```typescript
import { getEntitlementsRepository } from '@/lib/database/repositories';

const entitlementsRepo = getEntitlementsRepository();

// Get user's entitlements
const entitlements = await entitlementsRepo.getByUserId('user-123');

// Check if user has entitlement
const hasPremium = await entitlementsRepo.hasEntitlement('user-123', 'premium');

// Get expired entitlements for cleanup
const expired = await entitlementsRepo.getExpiredBeforeDate(cutoffDate);
```

## Edge Functions

Use semantic edge function calls instead of direct RPC:

```typescript
import { executeEdgeFunction } from '@/lib/database/edge';

// ❌ Old way: Direct RPC
const result = await supabase.rpc('create_invite_link', {
  world_id: '123',
  expires_in_days: 7
});

// ✅ New way: Semantic execution
const result = await executeEdgeFunction('createInviteLink', {
  worldId: '123',
  expiresInDays: 7
});
```

Available edge functions:
- `createInviteLink` - Create shareable invite
- `resolveInviteToken` - Validate invite token
- `deleteInviteLink` - Revoke invite
- `joinWorldWithInvite` - Accept invite and join world
- `leaveWorld` - Leave a world
- `removeWorldAccess` - Remove user from world

## Auth Operations

Use centralized auth operations instead of direct provider calls:

```typescript
import { signInUser, signUpUser, signOutUser } from '@/lib/auth/auth-operations';

// ❌ Old way: Direct auth calls
await supabase.auth.signInWithPassword({ email, password });

// ✅ New way: Centralized operations
const result = await signInUser(email, password);
if (result.success) {
  // User signed in
} else {
  // Handle error
  console.error(result.error);
}
```

Available auth operations:
- `signInUser(email, password)`
- `signUpUser(email, password, username?)`
- `sendPasswordReset(email)`
- `updatePassword(newPassword)`
- `resendConfirmationEmail(email)`
- `getCurrentSession()`
- `signOutUser()`

## Error Handling

All repository operations throw typed errors:

```typescript
import { getUserRepository } from '@/lib/database/repositories';

try {
  const user = await getUserRepository().getById('user-123');
} catch (error) {
  if (error.name === 'NotFoundError') {
    // User doesn't exist
    showUserNotFoundMessage();
  } else if (error.name === 'PermissionError') {
    // User doesn't have access
    showPermissionDeniedMessage();
  } else if (error.name === 'ValidationError') {
    // Invalid data
    showValidationError(error.message);
  } else {
    // Other database error
    showGenericError();
  }
}
```

## React Hooks Usage

### In Components

```typescript
import { useEffect, useState } from 'react';
import { getUserRepository, getWorldRepository } from '@/lib/database/repositories';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [worlds, setWorlds] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, worldsData] = await Promise.all([
          getUserRepository().getById(userId),
          getWorldRepository().getAccessibleWorlds(userId)
        ]);

        setUser(userData);
        setWorlds(worldsData);
      } catch (error) {
        // Handle error
      }
    }

    loadData();
  }, [userId]);

  // Render user profile
}
```

### In Custom Hooks

```typescript
import { useState, useEffect } from 'react';
import { getWorldRepository } from '@/lib/database/repositories';

export function useUserWorlds(userId) {
  const [worlds, setWorlds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    getWorldRepository()
      .getAccessibleWorlds(userId)
      .then(setWorlds)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { worlds, loading, error };
}

// Usage in component
function WorldList({ userId }) {
  const { worlds, loading, error } = useUserWorlds(userId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {worlds.map(world => (
        <li key={world.id}>{world.name} ({world.userRole})</li>
      ))}
    </ul>
  );
}
```

## Testing

### Mock Repositories

```typescript
import { registerRepository, clearRepositoryRegistry } from '@/lib/database/repositories';
import { MockUserRepository } from '@/lib/database/repositories/__mocks__/MockUserRepository';

describe('UserProfile Component', () => {
  beforeEach(() => {
    clearRepositoryRegistry();
    registerRepository('user', new MockUserRepository());
  });

  afterEach(() => {
    clearRepositoryRegistry();
  });

  it('should display user name', async () => {
    // Mock repository will return test data
    render(<UserProfile userId="test-user" />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });
});
```

### Integration Testing

```typescript
import { setupTestDatabase } from '@/__tests__/utils/test-database';

describe('User Registration Flow', () => {
  beforeEach(() => {
    setupTestDatabase(); // Registers mock repositories
  });

  it('should create user and world', async () => {
    // Test full user registration flow
    const user = await getUserRepository().create({
      authId: 'auth-123',
      username: 'testuser'
    });

    const world = await getWorldRepository().create({
      name: 'Test World',
      system: 'dnd5e',
      isDm: true
    });

    expect(user.username).toBe('testuser');
    expect(world.name).toBe('Test World');
  });
});
```

## Performance Optimization

### Parallel Queries

Execute independent operations in parallel:

```typescript
import { executeParallelQueries } from '@/lib/database/common';

// ❌ Sequential (slow)
const user = await getUserRepository().getById(userId);
const worlds = await getWorldRepository().getAccessibleWorlds(userId);
const invites = await getInviteRepository().getByWorldId(worldId);

// ✅ Parallel (fast)
const [user, worlds, invites] = await executeParallelQueries([
  getUserRepository().getById(userId),
  getWorldRepository().getAccessibleWorlds(userId),
  getInviteRepository().getByWorldId(worldId)
]);
```

### Caching

Repositories automatically handle caching. Results are cached and invalidated appropriately:

```typescript
// First call hits database
const user = await getUserRepository().getById('user-123'); // DB call

// Second call uses cache
const sameUser = await getUserRepository().getById('user-123'); // Cache hit

// After update, cache is invalidated
await getUserRepository().update('user-123', { username: 'new' }); // Invalidates cache
const updatedUser = await getUserRepository().getById('user-123'); // DB call again
```

## Migration Guide

### From Direct Database Calls

Replace direct `getDatabaseProvider()` calls:

```typescript
// Before
const worlds = await getDatabaseProvider()
  .from('worlds')
  .select('*, world_access!inner(*)')
  .eq('world_access.user_id', userId);

// After
const worlds = await getWorldRepository().getAccessibleWorlds(userId);
```

### From Direct RPC Calls

Replace `supabase.rpc()` calls:

```typescript
// Before
const result = await supabase.rpc('create_invite_link', {
  world_id: worldId,
  expires_in_days: 7
});

// After
const result = await executeEdgeFunction('createInviteLink', {
  worldId: worldId,
  expiresInDays: 7
});
```

### From Direct Auth Calls

Replace `supabase.auth.*` calls:

```typescript
// Before
await supabase.auth.signInWithPassword({ email, password });

// After
const result = await signInUser(email, password);
```

## Best Practices

### 1. Use Repository Methods, Not Direct Queries

Always use repository methods instead of direct database access:

```typescript
// ✅ Good
const user = await getUserRepository().getByAuthId(authId);

// ❌ Bad
const result = await getDatabaseProvider()
  .from('users')
  .select('*')
  .eq('auth_id', authId)
  .single();
```

### 2. Handle Errors Appropriately

Use typed error handling:

```typescript
try {
  await getWorldRepository().create(worldData);
} catch (error) {
  if (error.name === 'ValidationError') {
    showValidationMessage(error.message);
  } else if (error.name === 'PermissionError') {
    showPermissionMessage();
  }
}
```

### 3. Use Parallel Queries for Performance

```typescript
// ✅ Good: Parallel execution
const [user, worlds] = await executeParallelQueries([
  getUserRepository().getById(userId),
  getWorldRepository().getAccessibleWorlds(userId)
]);

// ❌ Bad: Sequential execution
const user = await getUserRepository().getById(userId);
const worlds = await getWorldRepository().getAccessibleWorlds(userId);
```

### 4. Test with Mock Repositories

```typescript
describe('MyComponent', () => {
  beforeEach(() => {
    registerRepository('user', new MockUserRepository());
  });

  it('should handle user data', () => {
    // Test with predictable mock data
  });
});
```

### 5. Use Semantic Edge Functions

```typescript
// ✅ Good: Semantic and backend-agnostic
await executeEdgeFunction('createInviteLink', params);

// ❌ Bad: Tightly coupled to Supabase RPC
await supabase.rpc('create_invite_link', params);
```

This repository pattern provides a clean, testable, and maintainable way to interact with your data layer while enabling future backend migrations.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\261 - Semantic Repository Pattern & True Database Abstraction\USAGE_GUIDE.md