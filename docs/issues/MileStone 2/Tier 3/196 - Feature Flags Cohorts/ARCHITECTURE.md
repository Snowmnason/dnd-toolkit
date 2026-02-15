# Phase 1-4: Cohorts Architecture

## Data Flow Diagram

```
┌─────────────────────────── App Initialization ────────────────────────────┐
│                                                                            │
│  AppKernel (bootstrap)                                                   │
│  ├─ FeatureFlagsManager.initialize(supabaseClient, userId)               │
│  └─ FeatureFlagsManager.bootstrapFlags() [ONE-TIME fetch]                │
│                                                                            │
│  ↓                                                                        │
│  Supabase Edge Function: get_feature_flags(userId)                       │
│  ├─ Returns:                                                             │
│  │  ├─ flags[] (feature flag definitions)                                │
│  │  ├─ entitlements[] (premium features)                                 │
│  │  ├─ overrides[] (per-user admin overrides)                            │
│  │  ├─ rollouts: Record<flagName, config> (percentage configs)           │
│  │  ├─ cohorts[] (Phase 3: all active cohorts)                           │
│  │  └─ user_cohort_memberships[] (Phase 3: user's memberships)           │
│  │                                                                        │
│  └─ RLS Filters (Supabase):                                              │
│     ├─ user_cohort_memberships filtered to current user                  │
│     └─ Only active cohorts returned                                      │
│                                                                            │
│  ↓                                                        [Encrypted]    │
│  SecureStorage: Cache flags, cohorts, memberships for offline use        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

┌──────────────────── Runtime Flag Evaluation ──────────────────┐
│                                                               │
│  isEnabledWithContext(flagName, context)                     │
│  ├─ Check LRU cache (Phase 2: 1-hour TTL, 256 entries max)  │
│  ├─ _resolveFlag(flagName, context)                         │
│  │  ├─ Step 1: Check enabled field (base)                   │
│  │  │                                                        │
│  │  ├─ Step 2 (Phase 3): Check cohorts (AND logic)          │
│  │  │  ├─ If flag has cohorts: ["beta_testers", ...]        │
│  │  │  ├─ For each cohort:                                  │
│  │  │  │  ├─ Check explicit membership (RLS-filtered)       │
│  │  │  │  ├─ If not explicit: check deterministic bucketing │
│  │  │  │      └─ isUserInCohort(userId, cohortId, cohort)  │
│  │  │  │         └─ FNV_HASH(userId + cohortId + seed) < %  │
│  │  │  └─ User must be in ANY cohort (OR logic)             │
│  │  │                                                        │
│  │  ├─ Step 3 (Phase 1): Check conditions (AND logic)       │
│  │  │  ├─ Simple: platform, environment, userRole (AND)    │
│  │  │  └─ Advanced: conditionLogic tree (AND/OR/NOT)        │
│  │  │                                                        │
│  │  ├─ Step 4: Resolve dependencies (all must be true)      │
│  │  │  └─ Recursively check dependsOn[] flags               │
│  │  │                                                        │
│  │  └─ Store result in LRU cache + memo (per-call)          │
│  │                                                           │
│  └─ Return: true | false                                    │
│                                                               │
│  Usage in Components:                                        │
│  ├─ React Hook: useFeatureFlag(flagName)                    │
│  ├─ Direct: FeatureFlagsManager.isEnabledWithContext(...)   │
│  └─ Template: {% if featureEnabled %}...{% endif %}         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Resolution Order (AND Logic)

Flag is enabled if **ALL** of the following are true:

```
1. enabled: true (base flag)
   AND
2. Cohort Check (if cohorts[] specified):
   ├─ Explicit membership (Phase 2) OR deterministic bucketing
   ├─ User must be in ANY of the required cohorts
   └─ Deterministic: FNV_HASH(userId + cohortId + seed) % 100 < percentage
   AND
3. Condition Check (if conditions or conditionLogic specified):
   ├─ Simple conditions: platform AND environment AND userRole
   ├─ Advanced: conditionLogic tree with AND/OR/NOT operators
   └─ Must match context supplied at runtime
   AND
4. Dependency Check (if dependsOn[] specified):
   ├─ Recursively resolve each dependent flag
   └─ All dependencies must be enabled (AND logic)

Result: enabled = step1 && step2 && step3 && step4
```

## Cohort Membership Priority

When checking if a user is in a cohort:

```
1. Explicit Membership (Phase 2, Highest Priority)
   ├─ Check user_cohort_memberships table
   ├─ RLS-enforced: only user's own memberships visible
   ├─ Check: is_active = true
   └─ If found → Return true (admin override)

2. Deterministic Bucketing (Phase 1, Fallback)
   ├─ Calculate: FNV_HASH(userId + cohortId + seed) % 100
   ├─ Compare: hash_value < percentage
   ├─ Seed behavior:
   │  ├─ Default seed: cohortId (e.g., "beta_testers")
   │  └─ Custom seed: for rebalancing (Phase 4)
   └─ If bucket < percentage → Return true
```

## Phase 4: Rebalancing with Seeds

Safe gradual rollout pattern:

```
Deterministic Bucketing Formula:
  bucket_value = FNV_HASH(userId + cohortId + seed) % 100

Example: Feature rollout from 10% → 50% → 100%

Day 1 (10% rollout, seed="v1"):
  hash(userId + "feature" + "v1") % 100 → [0-9] ✅ In cohort
  
Day 2 (50% rollout, same seed="v1"):
  hash(userId + "feature" + "v1") % 100 → [0-49] ✅ Still in cohort
  └─ Existing 10% users stay (hash in [0-9])
  └─ New 40% users are added (hash in [10-49])

Day 3 (100% rollout):
  hash(userId + "feature" + "v1") % 100 → [0-99] ✅ All users

Guarantee: Same user + same seed = same bucket range expansion
Result: NO USER CHURN as percentage increases
```

## Caching Architecture

### FeatureFlagsManagerClass State

```typescript
private cachedFlags: Map<string, FeatureFlagState>           // Global flags
private cachedCohorts: Map<string, CachedCohort>            // Cohorts by slug
private cachedUserCohortMemberships: CachedUserCohortMembership[]  // User's cohorts
private cachedEntitlements: Map<string, CachedEntitlement>  // Premium features
private cachedRollouts: Map<string, CachedRolloutConfig>    // Percentage configs
private evaluationCache: FlagEvaluationCache                // LRU cache (256 entries, 1h TTL)
```

### Storage Layer (SecureStorage, encrypted AES-CTR)

```
STORAGE_KEYS.FEATURE_FLAGS                          → flags + metadata
STORAGE_KEYS.FEATURE_FLAGS:cohorts                  → cohorts by slug
STORAGE_KEYS.FEATURE_FLAGS:user_cohort_memberships → user's memberships
STORAGE_KEYS.FEATURE_FLAGS:rollouts                 → rollout percentages
STORAGE_KEYS.FEATURE_FLAGS:overrides:{userId}      → per-user overrides
STORAGE_KEYS.ENTITLEMENTS:{userId}                 → premium features
```

### Update Flow

```
New Flags Version Available
  ↓
Edge Function: get_feature_flags(userId)
  ├─ Returns: flags, cohorts, user_cohort_memberships, ...
  ↓
Update Memory Cache:
  ├─ this.cachedFlags = new Map(...)
  ├─ this.cachedCohorts = new Map((c) => [c.slug, c], allCohorts)
  └─ this.cachedUserCohortMemberships = [...]
  ↓
Persist to SecureStorage (encrypted)
  ├─ setJSON(`:cohorts`, Object.fromEntries(this.cachedCohorts))
  └─ setJSON(`:user_cohort_memberships`, this.cachedUserCohortMemberships)
  ↓
Invalidate LRU Cache:
  └─ evaluationCache.clear() [fresh evaluations on next check]
```

## Offline Behavior

```
Online (Normal Mode):
  ├─ Edge Function returns fresh data
  ├─ Update memory + storage
  └─ Use fresh evaluations

Offline (No Network):
  ├─ Load from SecureStorage
  │  ├─ flags (last synced config)
  │  ├─ cohorts (last synced cohorts)
  │  └─ user_cohort_memberships (user's memberships)
  ├─ Use cached data for evaluations
  └─ Continue to support flag checks

Clock Skew Protection:
  ├─ Store bootstrap timestamp
  ├─ On offline checks: verify device clock within tolerance (60s)
  └─ If clock invalid: deny access (fail-secure)
```

## Type System

### Server Response (GetFeatureFlagsResponse)

```typescript
interface GetFeatureFlagsResponse {
  flags: CachedFeatureFlag[];                    // Feature flag definitions
  entitlements: CachedEntitlement[];              // Premium features
  overrides: FeatureFlagOverrideRow[];            // Per-user overrides
  rollouts: Record<string, CachedRolloutConfig>; // Percentage configs
  
  // Phase 3 (Cohorts)
  cohorts?: CachedCohort[];                       // All active cohorts
  cohort_assignments?: any[];                     // Future: flag-to-cohort mappings
  user_cohort_memberships?: CachedUserCohortMembership[];  // User's memberships
  
  fetchedAt: number;                              // When this was fetched
  version: "v1";                                  // Schema version
}
```

### Cohort Types

```typescript
interface CachedCohort {
  id: string;              // UUID, primary key from database
  slug: string;            // Stable identifier (used in flag config)
  name: string;            // Display name
  description?: string;
  percentage: number;      // 0-100 for bucketing
  seed?: string;           // Rebalancing seed (Phase 4)
  is_active: boolean;      // Admins can deactivate
  metadata?: Record<string, any>;
  created_at: string;      // ISO 8601
  updated_at: string;      // ISO 8601
}

interface CachedUserCohortMembership {
  id: string;              // UUID
  user_id: string;         // UUID, RLS-filtered to current user
  cohort_id: string;
  cohort_slug?: string;    // Denormalized for convenience
  source: "direct" | "computed" | "invited";  // How user was added
  is_active?: boolean;     // Can expire memberships
  reason?: string;
  expires_at?: string;     // Optional expiration (ISO 8601)
  created_at: string;
  updated_at: string;
}
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Flag evaluation | O(1) average | LRU cache hit (256 entries, 1h TTL) |
| Cohort lookup | O(1) | Map<slug, cohort> |
| Membership check | O(n) | n = user's cohorts (typically < 10) |
| Deterministic bucketing | O(1) | FNV hash + modulo |
| Condition evaluation | O(m) | m = condition depth (typically < 5) |
| Dependency resolution | O(d) | d = dependency chain depth (with cycle detection) |

### Memory Usage

```
Per-User Baseline:
  ├─ cachedFlags: ~5-20 KB (stored as Map)
  ├─ cachedCohorts: ~50-200 KB (index of all cohorts by slug)
  ├─ cachedUserCohortMemberships: ~1-10 KB (user's memberships)
  ├─ cachedEntitlements: ~5-20 KB
  ├─ evaluationCache: ~50 KB (256 entries × ~200 bytes)
  └─ Total: ~150-400 KB per user (acceptable)
```

### Network & Latency

```
Bootstrap (One-Time):
  ├─ Edge Function call: ~100-500ms (includes RLS filtering)
  ├─ Storage write (SecureStorage): ~10-50ms
  └─ Total: ~150-600ms non-blocking in app startup

Evaluation (Runtime):
  ├─ Cache hit: <1ms
  ├─ Cache miss: ~1-5ms (in-memory evaluation)
  └─ No runtime network calls (cached from bootstrap)

Refresh (Manual):
  ├─ Edge Function call: ~100-500ms
  ├─ Clear evaluation cache: <1ms
  └─ Background task (non-blocking)
```

## Security & Safety

### RLS (Row-Level Security) Enforcement

```sql
-- user_cohort_memberships RLS policy
SELECT * FROM user_cohort_memberships
WHERE user_id = auth.uid()
  AND is_active = true;

-- Guarantee: Users can only see their own memberships
-- Enforced at database layer (not client-side)
```

### Deterministic Bucketing Fairness

```
FNV Hash Properties:
  ├─ Uniformly distributed: ~percentage% of users in each bucket
  ├─ Deterministic: Same input = same output
  ├─ Non-reversible: Cannot deduce userId from hash
  └─ Seed-safe: Different seeds → different buckets (rebalancing)
```

### Offline Safety

```
Clock Skew Protection:
  ├─ Store bootstrap timestamp
  ├─ If offline and clock moves >60s: deny premium features
  └─ Prevents: abuse via system clock manipulation

Cached Data Freshness:
  ├─ LRU cache: 1-hour TTL
  ├─ If stale: use last stored value (fail-open)
  └─ Premium features: fail-secure (deny on stale entitlements)
```

## Future Enhancements

1. **Recurring Sync** – Background job to refresh flags every 24 hours
2. **Push Notifications** – Real-time cohort/flag changes via WebSocket
3. **Admin UI** – Dashboard to create cohorts, assign users, manage memberships
4. **A/B Testing Variants** – Extend cohorts to support multivariate testing
5. **Cohort Priority** – Optional priority field for conflicting cohorts
6. **Cohort Logic** – Advanced `cohortLogic` tree (AND/OR/NOT) for complex membership rules
