# Entitlements & Subscription Provider

Scaffolding utilities that support premium features without implementing real subscription logic yet.

## Overview

### Entitlements Helper (`lib/utils/entitlements.ts`)
Centralizes all user limits and quotas in one place, so you don't scatter `isPremium ? X : Y` checks throughout your codebase.

**Current state:** Stub values (all users get "premium" limits) with TODO comments.

### Subscription Provider (`providers/SubscriptionProvider.tsx`)
Context wrapper around `SubscriptionManager` to share subscription state app-wide without redundant fetches.

**Current state:** Stub provider (no real optimization yet, but structure ready).

---

## Why Add These Now?

1. **Entitlements** – Single source of truth prevents refactoring later
2. **Provider** – Wrapper ready to add caching/polling when backend exists

Both follow the same pattern: stub now, wire to real logic later without code reorganization.

---

## Using Entitlements

### Basic Limit Checks
```tsx
import { Entitlements } from '@/lib/utils/entitlements';

// Service layer
function canAddCharacter(currentCount: number): boolean {
  if (currentCount >= Entitlements.getCharacterLimit()) {
    return false;
  }
  return true;
}

// Component
function CharacterCounter({ count }: { count: number }) {
  const limit = Entitlements.getCharacterLimit();
  return <Text>{count} / {limit}</Text>;
}
```

### Feature Access
```tsx
const canExport = await Entitlements.canUseFeature('advanced_export');
if (!canExport) {
  throw new Error('Export requires premium');
}
```

### Storage Quota
```tsx
const quotaBytes = Entitlements.getStorageBytes();
const quotaMB = quotaBytes / (1024 * 1024);
```

### Get Full Quota Info
```tsx
const quota = await Entitlements.getQuotaInfo(userId);
// {
//   characters: { used: 3, limit: 100 },
//   storage: { used: 512000, limit: 10737418240 },
//   worlds: { used: 1, limit: 50 },
// }
```

---

## Expanding Entitlements

When you implement premium features, replace stubs in `lib/utils/entitlements.ts`:

### Step 1: Update Stub Methods
**Before:**
```ts
static getCharacterLimit(): number {
  return 100; // TODO: wire to SubscriptionManager.isPremiumCached()
}
```

**After:**
```ts
static getCharacterLimit(): number {
  const isPremium = SubscriptionManager.isPremiumCached();
  return isPremium ? 100 : 5;
}
```

### Step 2: Add New Premium Features
```ts
static getAdvancedMapsLimit(): number {
  const hasAdvanced = SubscriptionManager.hasFeatureCached('advanced_maps');
  return hasAdvanced ? 50 : 0; // Free users can't use this
}

static getCampaignSlots(): number {
  const isPremium = SubscriptionManager.isPremiumCached();
  return isPremium ? 20 : 0;
}
```

### Step 3: Update Export Formats
```ts
static getExportFormats(): string[] {
  const baseFormats = ['json', 'csv'];
  const isPremium = SubscriptionManager.isPremiumCached();
  
  if (isPremium) {
    baseFormats.push('pdf', 'docx', 'foundry-vtt');
  }
  
  return baseFormats;
}
```

### Step 4: Add Usage Tracking
```ts
static async getQuotaInfo(userId: string): Promise<QuotaInfo> {
  const isPremium = SubscriptionManager.isPremiumCached();
  
  // Calculate actual usage from database
  const [characterCount, storageUsed, worldCount] = await Promise.all([
    db.characters.count({ userId }),
    db.storage.getUsedBytes(userId),
    db.worlds.count({ userId }),
  ]);
  
  return {
    characters: { used: characterCount, limit: this.getCharacterLimit() },
    storage: { used: storageUsed, limit: this.getStorageBytes() },
    worlds: { used: worldCount, limit: this.getWorldLimit() },
  };
}
```

---

## Using Subscription Provider

### Wrap Your App
In your root layout (`app/_layout.tsx`) or similar:

```tsx
import { SubscriptionProvider } from '@/providers/SubscriptionProvider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ScaleProvider>
        <PlatformProvider>
          <SubscriptionProvider>
            <AppParamsProvider>
              {/* Your app */}
            </AppParamsProvider>
          </SubscriptionProvider>
        </PlatformProvider>
      </ScaleProvider>
    </ThemeProvider>
  );
}
```

### Access Subscription State
```tsx
import { useSubscription } from '@/providers/SubscriptionProvider';

function ProfileHeader() {
  const { isPremium, isLoading, refresh } = useSubscription();
  
  if (isLoading) return <Spinner />;
  
  return (
    <View>
      <Text>{isPremium ? '👑 Premium' : 'Free'}</Text>
      <Button onPress={refresh} title="Refresh Subscription" />
    </View>
  );
}
```

---

## Expanding Subscription Provider

When you wire the backend, update `providers/SubscriptionProvider.tsx`:

### Step 1: Add Refresh Trigger
Connect to a "Buy Premium" button or manual refresh:
```tsx
export function usePremiumRefresh() {
  const { refresh } = useSubscription();
  
  return async () => {
    // Called after user completes purchase
    await refresh();
    // UI re-renders with new premium state
  };
}
```

### Step 2: Add Polling (Optional)
For keeping subscription state fresh during a session:
```tsx
useEffect(() => {
  // Poll every 5 minutes to catch subscription changes
  const interval = setInterval(() => {
    refresh();
  }, 5 * 60 * 1000);
  
  return () => clearInterval(interval);
}, [refresh]);
```

### Step 3: Add Error Handling
```tsx
const [error, setError] = useState<Error | null>(null);

const refresh = async () => {
  setError(null);
  try {
    const sub = await SubscriptionManager.refresh();
    setSubscription(sub);
  } catch (err) {
    setError(err instanceof Error ? err : new Error('Unknown error'));
    // Show toast/alert to user
  }
};
```

---

## Tips

- **When to use Entitlements:** Anywhere you check limits (services, components, validators)
- **When to use Provider:** For app-wide subscription state that might change
- **Stubs are intentional:** They let you structure code now, implement logic later
- **Keep TODO comments:** They document exactly what needs to change
- **Test with different limits:** Toggle stubs between free/premium values to test UX
