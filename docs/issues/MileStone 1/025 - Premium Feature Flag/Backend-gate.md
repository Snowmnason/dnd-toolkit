# Backend Gating (Services, APIs, Database)

How to gate non-UI logic like database limits, storage quotas, API rate limits, and feature entitlements in service layers.

## Quick Reference

```ts
import { SubscriptionManager } from '@/lib/premium';
import { FeatureFlags } from '@/lib/feature-flags';

// Sync checks (cached state)
const isPremium = SubscriptionManager.isPremiumCached();
const hasFeature = SubscriptionManager.hasFeatureCached('extended_storage');
const flagEnabled = FeatureFlags.isEnabled('advancedSearch');

// Async checks (may trigger refresh)
const isPremium = await SubscriptionManager.isPremium();
const hasFeature = await SubscriptionManager.hasFeature('extended_storage');
```

## When to Use Sync vs Async

### Sync (Cached) – Use for:
- Quick checks in utility functions
- Tight loops or performance-critical paths
- Initial value determination
- **Warning:** Returns `false` if cache is empty; warm cache on app bootstrap

### Async – Use for:
- Critical authorization checks
- First check after app launch
- When you need fresh state
- API handlers where latency is acceptable

## Common Patterns

### Database Record Limits
```ts
import { SubscriptionManager } from '@/lib/premium';

export function canAddCharacter(userId: string, currentCount: number): boolean {
  const isPremium = SubscriptionManager.isPremiumCached();
  const limit = isPremium ? 100 : 5;
  
  if (currentCount >= limit) {
    console.warn(`[Characters] User ${userId} hit limit (${limit})`);
    return false;
  }
  
  return true;
}

// Usage in character creation
async function createCharacter(data: CharacterData): Promise<Character> {
  const count = await getCharacterCount(data.userId);
  
  if (!canAddCharacter(data.userId, count)) {
    throw new Error('Character limit reached. Upgrade to premium for more slots.');
  }
  
  return await db.characters.create(data);
}
```

### Storage Quotas
```ts
export function getStorageQuota(): { used: number; total: number } {
  const hasExtended = SubscriptionManager.hasFeatureCached('extended_storage');
  
  return {
    used: 0, // Calculate actual usage
    total: hasExtended ? 10 * 1024 * 1024 * 1024 : 100 * 1024 * 1024, // 10GB : 100MB
  };
}

export async function canUploadFile(
  fileSize: number,
  currentUsage: number
): Promise<boolean> {
  const quota = getStorageQuota();
  
  if (currentUsage + fileSize > quota.total) {
    return false;
  }
  
  return true;
}
```

### API Rate Limits
```ts
interface RateLimitConfig {
  requestsPerHour: number;
  burstSize: number;
}

export async function getRateLimitConfig(userId: string): Promise<RateLimitConfig> {
  const isPremium = await SubscriptionManager.isPremium();
  
  return isPremium
    ? { requestsPerHour: 10000, burstSize: 100 }
    : { requestsPerHour: 100, burstSize: 10 };
}

// Usage in API middleware
async function rateLimitMiddleware(req: Request) {
  const config = await getRateLimitConfig(req.userId);
  const count = await getRequestCount(req.userId, '1h');
  
  if (count >= config.requestsPerHour) {
    throw new Error('Rate limit exceeded');
  }
  
  // Process request...
}
```

### Feature-Specific Logic
```ts
import { FeatureFlags } from '@/lib/feature-flags';
import { SubscriptionManager } from '@/lib/premium';

export async function processWorldData(world: World): Promise<ProcessedWorld> {
  // Feature flag check
  const useNewParser = FeatureFlags.isEnabled('newWorldParser');
  
  // Premium feature check
  const hasAdvanced = await SubscriptionManager.hasFeature('advanced_worlds');
  
  const baseData = useNewParser 
    ? parseWorldV2(world) 
    : parseWorldV1(world);
  
  if (hasAdvanced) {
    return {
      ...baseData,
      advancedMetrics: calculateAdvancedMetrics(world),
      aiSuggestions: await generateSuggestions(world),
    };
  }
  
  return baseData;
}
```

### Export/Import Limits
```ts
export function getExportFormats(): string[] {
  const isPremium = SubscriptionManager.isPremiumCached();
  
  const formats = ['json', 'csv'];
  
  if (isPremium) {
    formats.push('pdf', 'docx', 'foundry-vtt');
  }
  
  return formats;
}

export async function exportWorld(worldId: string, format: string): Promise<Blob> {
  const allowedFormats = getExportFormats();
  
  if (!allowedFormats.includes(format)) {
    throw new Error(`Format ${format} requires premium subscription`);
  }
  
  return await generateExport(worldId, format);
}
```

### Complex Authorization
```ts
interface AccessControl {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
}

export async function getWorldPermissions(
  worldId: string,
  userId: string
): Promise<AccessControl> {
  const world = await db.worlds.findById(worldId);
  const isOwner = world.ownerId === userId;
  const isPremium = await SubscriptionManager.isPremium();
  const sharingEnabled = FeatureFlags.isEnabled('worldSharing');
  
  return {
    canRead: isOwner || world.sharedWith.includes(userId),
    canWrite: isOwner,
    canDelete: isOwner,
    canShare: isOwner && isPremium && sharingEnabled,
  };
}
```

## Utility Helpers

Create reusable helpers for common checks:

```ts
// lib/utils/entitlements.ts
import { SubscriptionManager } from '@/lib/premium';

export class Entitlements {
  static getCharacterLimit(): number {
    return SubscriptionManager.isPremiumCached() ? 100 : 5;
  }
  
  static getNPCLimit(): number {
    return SubscriptionManager.isPremiumCached() ? 500 : 25;
  }
  
  static getWorldLimit(): number {
    return SubscriptionManager.isPremiumCached() ? 50 : 3;
  }
  
  static getStorageBytes(): number {
    const hasExtended = SubscriptionManager.hasFeatureCached('extended_storage');
    return hasExtended ? 10 * 1024 ** 3 : 100 * 1024 ** 2;
  }
  
  static async canUseFeature(featureKey: string): Promise<boolean> {
    return await SubscriptionManager.hasFeature(featureKey);
  }
}

// Usage
import { Entitlements } from '@/lib/utils/entitlements';

const characterCount = await db.characters.count({ userId });
if (characterCount >= Entitlements.getCharacterLimit()) {
  throw new Error('Character limit reached');
}
```

## Error Handling

Consistent error messages for gated features:

```ts
export class EntitlementError extends Error {
  constructor(
    message: string,
    public featureKey?: string,
    public requiresPremium = false
  ) {
    super(message);
    this.name = 'EntitlementError';
  }
}

// Usage
function validateEntitlement(feature: string, isPremium: boolean) {
  if (!isPremium) {
    throw new EntitlementError(
      `Feature "${feature}" requires premium subscription`,
      feature,
      true
    );
  }
}
```

## Cache Warming

Ensure cache is populated on app bootstrap to avoid `false` returns:

```ts
// hooks/use-app-bootstrap.tsx (or similar)
import { SubscriptionManager } from '@/lib/premium';

export function useAppBootstrap() {
  useEffect(() => {
    // Warm subscription cache
    SubscriptionManager.getSubscription().catch(console.error);
  }, []);
}
```

## Testing

Mock subscription state for tests:

```ts
// __tests__/subscription.test.ts
import { SubscriptionManager } from '@/lib/premium';

// Mock the getSubscription method
jest.spyOn(SubscriptionManager, 'getSubscription').mockResolvedValue({
  tier: 'premium',
  features: ['extended_storage', 'advanced_worlds'],
  fetchedAt: Date.now(),
});

test('premium users get higher limits', async () => {
  const isPremium = await SubscriptionManager.isPremium();
  expect(isPremium).toBe(true);
  
  const limit = Entitlements.getCharacterLimit();
  expect(limit).toBe(100);
});
```

## Tips

- **Warm cache early:** Call `getSubscription()` on app launch
- **Sync for speed:** Use cached methods in tight loops
- **Async for auth:** Use async methods for critical checks
- **Consistent limits:** Centralize entitlement values in helper class
- **Clear errors:** Throw descriptive errors mentioning the feature and what's needed
- **Log blocks:** Track when users hit limits for product insights
