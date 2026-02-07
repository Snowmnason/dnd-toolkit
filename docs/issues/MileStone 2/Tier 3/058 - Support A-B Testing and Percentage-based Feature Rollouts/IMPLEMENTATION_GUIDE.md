# Implementation Guide: A/B Testing and Percentage-Based Feature Rollouts

This guide explains the current code structure and architecture of the rollout system.

## Core Components

### Rollout Engine (`lib/feature-flags/rollout.ts`)

The foundation of the rollout system using FNV-1a hashing for deterministic user bucketing.

#### Key Functions

```typescript
// Deterministic hash-based bucketing (0-99)
bucketPercent(userId: string, flagName: string, seed?: string): number

// Check if user is in rollout
isInRollout(userId: string, flagName: string, percentage: number, seed?: string): boolean

// Memoized versions for performance
getBucketMemoized(userId: string, flagName: string, seed?: string): number
isInRolloutMemoized(userId: string, flagName: string, percentage: number, seed?: string): boolean

// Clear memoization cache
clearBucketCache(): void
```

#### Hash Algorithm

Uses FNV-1a 32-bit hash for uniform distribution:
- Input: `${userId}:${flagName}:${seed}`
- Output: Bucket 0-99
- Same inputs always produce same bucket (deterministic)
- Different seeds rebalance users while maintaining percentages

### Feature Flags Manager (`lib/feature-flags/server-sync.ts`)

Extends the existing feature flag system with rollout evaluation.

#### New Properties

```typescript
class FeatureFlagsManagerClass {
  // Existing properties...
  private cachedRollouts: Map<string, CachedRolloutConfig> = new Map();

  // New methods
  evaluateRollout(userId: string, flagName: string, fallback?: boolean): Promise<boolean>
  getRollouts(): Record<string, CachedRolloutConfig>
}
```

#### Bootstrap Flow

```
App Startup
    ↓
FeatureFlagsManager.bootstrapFlags()
    ↓
Edge Function: get_feature_flags
    ↓
Returns: { flags, entitlements, overrides, rollouts }
    ↓
cachedRollouts = Map of rollout configs
    ↓
SecureStorage: FEATURE_FLAGS:rollouts (encrypted cache)
```

### Navigation System (`lib/navigation/navigation-config.ts`)

Route-level A/B testing support.

#### Route Configuration

```typescript
interface RouteConfig {
  // Existing fields...
  variants?: RouteVariantsMap;
  defaultVariant?: string;
}

interface RouteVariant {
  id: string;
  title?: string;
  percentage: number;
  seed?: string;
  metadata?: Record<string, any>;
}
```

#### Variant Evaluation

```typescript
evaluateRouteVariant(config: RouteConfig, userId: string): Promise<string | undefined>
```

Uses flag name format: `${route.path}:${variantId}` for rollout evaluation.

## Database Schema

### feature_flag_rollouts Table

```sql
CREATE TABLE feature_flag_rollouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name text NOT NULL,
  percentage smallint NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  seed text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,

  CONSTRAINT feature_flag_rollouts_flag_name_key UNIQUE (flag_name),
  CONSTRAINT feature_flag_rollouts_flag_name_fkey
    FOREIGN KEY (flag_name) REFERENCES feature_flags (flag_name) ON DELETE CASCADE,
  CONSTRAINT feature_flag_rollouts_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT feature_flag_rollouts_percentage_check
    CHECK (percentage >= 0 AND percentage <= 100)
);
```

### Indexes

```sql
-- Fast lookup by flag name
CREATE INDEX idx_feature_flag_rollouts_flag_name
  ON feature_flag_rollouts USING btree (flag_name);

-- Efficient filtering for active rollouts
CREATE INDEX idx_feature_flag_rollouts_flag_name_active
  ON feature_flag_rollouts USING btree (flag_name, is_active);

-- Filter active rollouts during Edge Function queries
CREATE INDEX idx_feature_flag_rollouts_is_active
  ON feature_flag_rollouts USING btree (is_active);
```

### Row Level Security

```sql
-- Authenticated users can read rollouts
CREATE POLICY rollouts_authenticated_read ON feature_flag_rollouts
  FOR SELECT USING (true);

-- Admins can manage rollouts
CREATE POLICY rollouts_admin_write ON feature_flag_rollouts
  FOR ALL USING (auth.jwt()->>'role' = 'admin');
```

## Edge Function Integration

### get_feature_flags (`supabase/functions/get_feature_flags/`)

#### Types (`types.ts`)

```typescript
export interface RolloutConfigRow {
  percentage: number; // 0-100
  seed?: string;
}

export interface GetFeatureFlagsResponse {
  flags: FeatureFlagRow[];
  entitlements: EntitlementRow[];
  overrides: FeatureFlagOverrideRow[];
  rollouts: Record<string, RolloutConfigRow>; // NEW
  fetchedAt: number;
  version: "v1";
}
```

#### Queries (`queries.ts`)

```typescript
export async function fetchRolloutConfigs(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("feature_flag_rollouts")
    .select("flag_name, percentage, seed")
    .eq("is_active", true);

  // Convert to map: { flagName: { percentage, seed? } }
  const rollouts: Record<string, { percentage: number; seed?: string }> = {};
  for (const row of data || []) {
    rollouts[row.flag_name] = {
      percentage: row.percentage,
      seed: row.seed || undefined,
    };
  }
  return rollouts;
}
```

#### Handler (`index.ts`)

```typescript
// Parallel fetch includes rollouts
const [flags, entitlements, overrides, rollouts] = await Promise.all([
  fetchFeatureFlags(supabase),
  fetchEntitlementsByUserId(supabase, userId),
  fetchOverridesByUserId(supabase, userId),
  fetchRolloutConfigs(supabase), // NEW
]);

// Response includes rollouts
return {
  flags,
  entitlements,
  overrides,
  rollouts: rollouts || {},
  fetchedAt: Date.now(),
  version: "v1",
};
```

## Storage & Caching

### SecureStorage Keys

- `FEATURE_FLAGS`: Global flags + metadata
- `FEATURE_FLAGS:rollouts`: Rollout configurations (encrypted)
- `FEATURE_FLAGS:${OVERRIDE_CACHE_KEY_PREFIX}${userId}`: Per-user overrides

### Cache Strategy

- **Bootstrap**: One-time fetch at app startup
- **Offline**: Uses cached values from SecureStorage
- **Realtime**: No realtime updates for rollouts (static configs)
- **Expiration**: No expiration (rollouts are intentional static)

## Performance Considerations

### Memoization

- Bucket calculations cached per session in `bucketCache` Map
- Key format: `${userId}:${flagName}:${seed}`
- Cleared on app restart (session-based)

### Database Optimization

- `is_active` filter reduces query size
- Composite index on `(flag_name, is_active)` for efficient lookups
- Foreign key to `feature_flags` ensures referential integrity

### Edge Function

- Parallel fetching of all data sources
- Rollouts fetched once per request (not per-user)
- Cached in Supabase for performance

## Error Handling

### Graceful Degradation

- Missing rollout config → Uses `fallback` parameter
- Database errors → Falls back to cached values
- Network issues → Uses offline cache
- Invalid percentages → Clamped to 0-100 range

### Logging

```typescript
logger.category("feature_flags").debug("Rollout evaluation", {
  flagName,
  userId,
  percentage,
  inRollout,
  bucket,
});
```

## Testing Strategy

### Unit Tests

- Deterministic bucketing verification
- Percentage boundary testing (0%, 50%, 100%)
- Seed rebalancing validation
- Memoization correctness

### Integration Tests

- FeatureFlagsManager.evaluateRollout() end-to-end
- Edge Function response parsing
- Offline cache behavior
- Route variant evaluation

## Migration Path

### From Hardcoded Rollouts

**Before:**
```typescript
// Hardcoded in Edge Function
const rollouts = {
  'feature_a': { percentage: 10 },
  'feature_b': { percentage: 50 },
};
```

**After:**
```sql
-- Configurable in database
INSERT INTO feature_flag_rollouts (flag_name, percentage, is_active)
VALUES ('feature_a', 10, true), ('feature_b', 50, true);
```

### Benefits

- **Admin Control**: Change rollouts without code deployment
- **Audit Trail**: Track rollout changes and creators
- **A/B Testing**: Multiple variants per feature
- **Gradual Rollouts**: Safe feature deployment
- **Offline Support**: Cached configurations work offline</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 1\058 - Support A-B Testing and Percentage-based Feature Rollouts\IMPLEMENTATION_GUIDE.md