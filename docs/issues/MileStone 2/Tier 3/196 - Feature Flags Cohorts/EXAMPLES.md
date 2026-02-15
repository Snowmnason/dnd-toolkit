# Phase 1-4: Real-World Cohort Examples

## Example 1: Beta Tester Rollout (Simple, Phase 1)

**Scenario:** Release "Advanced Maps" feature to beta testers only.

### Configuration

```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "description": "Advanced map visualization with heat maps",
      "kind": "beta",
      "cohorts": ["beta_testers"]
    }
  }
}
```

### Cohort Definition (Server-Side, Phase 2)

```sql
INSERT INTO cohorts (id, slug, name, percentage, is_active) VALUES
  ('uuid-1', 'beta_testers', 'Beta Testers', 100, true);
```

### Usage in Code

```typescript
// Simple check
const enabled = FeatureFlagsManager.isEnabledWithContext("advancedMaps", {
  userId: "user-123"
});

// With hook
export function AdvancedMapsComponent() {
  const isBetaTester = useFeatureFlag("advancedMaps");
  
  if (!isBetaTester) {
    return <div>Advanced Maps coming soon...</div>;
  }
  
  return <AdvancedMapViewer />;
}
```

### Result

- Only users explicitly assigned to `beta_testers` cohort can see feature
- Admins manually assign users via database
- Other users see "Coming soon" placeholder

---

## Example 2: Enterprise + Platform Combination (Phase 3: Cohorts + Conditions)

**Scenario:** Release "Team Collaboration" feature to enterprise customers on Web and iOS only.

### Configuration

```json
{
  "featureFlags": {
    "teamCollaboration": {
      "enabled": true,
      "description": "Real-time team collaboration tools",
      "kind": "premium",
      "cohorts": ["enterprise"],
      "conditions": {
        "platform": "web|ios"
      }
    }
  }
}
```

### Cohort Definition

```sql
INSERT INTO cohorts (id, slug, name, percentage, is_active) VALUES
  ('uuid-2', 'enterprise', 'Enterprise Customers', 100, true);
```

### Explicit Membership (Phase 2)

```sql
-- Assign company "Acme Inc" users to enterprise cohort
INSERT INTO user_cohort_memberships (user_id, cohort_id, source) VALUES
  ('user-acme-001', 'uuid-2', 'direct'),
  ('user-acme-002', 'uuid-2', 'direct'),
  ('user-acme-003', 'uuid-2', 'direct');
```

### Resolution

For user to see feature: **ALL** must be true
1. ✅ `enabled: true`
2. ✅ User is in `enterprise` cohort (explicit membership)
3. ✅ Platform is `web` or `ios` (context check)

**Scenario Outcomes:**

| User | Cohort | Platform | Result |
|------|--------|----------|--------|
| Acme user | enterprise | web | ✅ See feature |
| Acme user | enterprise | android | ❌ Hidden (wrong platform) |
| Regular user | — | web | ❌ Hidden (not enterprise) |
| Acme user (inactive) | enterprise (inactive) | web | ❌ Hidden (membership inactive) |

---

## Example 3: Gradual Rollout with Rebalancing (Phase 4: Seeds)

**Scenario:** Roll out "New Report Engine" to 10% of users, then 50%, then everyone (without losing users).

### Day 1: 10% Rollout

```sql
-- Server-side definition (Phase 2)
INSERT INTO cohorts (id, slug, name, percentage, seed, is_active) VALUES
  ('uuid-3', 'reporting_v2_rollout', 'Reporting V2 Rollout', 10, 'reporting_v2', true);
```

```json
{
  "featureFlags": {
    "reportingV2": {
      "enabled": true,
      "cohorts": ["reporting_v2_rollout"]
    }
  }
}
```

```typescript
// Which users get the new engine?
// Approximately 10% of all users (deterministic hash)
const hash = FNV_HASH("user-123" + "reporting_v2_rollout" + "reporting_v2") % 100;
// If hash < 10 → new engine enabled
```

**User Distribution:**
- Users [0-9]%: ✅ New engine
- Users [10-99]%: ❌ Old engine

### Day 2: Expand to 50%

```sql
-- Same seed, different percentage
UPDATE cohorts SET percentage = 50 WHERE slug = 'reporting_v2_rollout';
```

```typescript
// User hashes to same value, check against new percentage
const hash = FNV_HASH("user-123" + "reporting_v2_rollout" + "reporting_v2") % 100;
// If hash < 50 → new engine enabled
// User at hash=5: Still in [0-49] ✅ Still enabled
// User at hash=25: Still in [0-49] ✅ Newly enabled
// User at hash=75: Not in [0-49] ❌ Still disabled
```

**User Distribution:**
- Users [0-49]%: ✅ New engine (includes all Day 1 users)
- Users [50-99]%: ❌ Old engine

### Day 3: Full Rollout (100%)

```sql
UPDATE cohorts SET percentage = 100 WHERE slug = 'reporting_v2_rollout';
```

**User Distribution:**
- All users: ✅ New engine

### Guarantee

**No user churn!** Users who had the feature on Day 1 keep it on Day 2 and Day 3.

#### Why Seed Matters

```
WITHOUT seed (❌ Bad):
  Day 1 hash: FNV_HASH("user-123" + "reporting_v2_rollout") % 100 → 5
  Day 2 hash: FNV_HASH("user-123" + "reporting_v2_rollout") % 100 → 5 (same)
  // User stays enabled ✅ (happens to work)
  
  BUT if different cohort ID:
  Day 1 hash: FNV_HASH("user-123" + "rollout_10pct") % 100 → 25
  Day 2 hash: FNV_HASH("user-123" + "rollout_50pct") % 100 → 75
  // User at hash=25: In 10% but not in 50% ❌ CHURN!

WITH seed (✅ Good):
  Day 1 hash: FNV_HASH("user-123" + "cohortId" + "seed") % 100 → 5
  Day 2 hash: FNV_HASH("user-123" + "cohortId" + "seed") % 100 → 5 (same seed)
  // Hash never changes, user stays in [0-49] ✅ STABLE
```

### Code Example

```typescript
// Gradual rollout helper
async function expandRollout(cohortSlug: string, newPercentage: number) {
  // Admin updates cohort percentage in database
  // IMPORTANT: Keep seed the same!
  await supabase
    .from("cohorts")
    .update({ percentage: newPercentage })
    .eq("slug", cohortSlug);
  
  // Clear evaluation cache on next refresh
  // Users will see new percentage on next flag check
}

// Usage
await expandRollout("reporting_v2_rollout", 50);  // Day 2: 50%
await expandRollout("reporting_v2_rollout", 100); // Day 3: 100%
```

---

## Example 4: Multiple Cohorts + Internal Testing (Phase 3)

**Scenario:** Release "AI Assistant" feature to:
1. Internal team (100% access immediately)
2. Beta testers (percentage-based expansion)
3. Enterprise customers (full percentage)

### Configuration

```json
{
  "featureFlags": {
    "aiAssistant": {
      "enabled": true,
      "description": "AI-powered assistant for campaign planning",
      "kind": "premium",
      "cohorts": ["internal", "beta_ai_rollout", "enterprise"]
    }
  }
}
```

### Cohort Definitions

```sql
INSERT INTO cohorts (id, slug, name, percentage, seed, is_active) VALUES
  ('uuid-4', 'internal', 'Internal Team', 100, NULL, true),
  ('uuid-5', 'beta_ai_rollout', 'Beta AI Testers', 20, 'ai_v1', true),
  ('uuid-6', 'enterprise', 'Enterprise Customers', 100, NULL, true);
```

### Membership Strategy

```sql
-- Internal team: 100% explicit
INSERT INTO user_cohort_memberships (user_id, cohort_id, source) VALUES
  ('employee-1', 'uuid-4', 'direct'),
  ('employee-2', 'uuid-4', 'direct');

-- Beta testers: 20% deterministic bucketing (no explicit needed)
-- Enterprise: Explicit for account owners
INSERT INTO user_cohort_memberships (user_id, cohort_id, source) VALUES
  ('acme-org-owner', 'uuid-6', 'direct');
```

### Resolution Rules

User sees AI Assistant if in **ANY** cohort:

| User Type | Internal | Beta(20%) | Enterprise | Result |
|-----------|----------|-----------|------------|--------|
| Employee | ✅ | — | — | ✅ Yes |
| Random user | ❌ | ✅ (lucky) | ❌ | ✅ Yes |
| Random user | ❌ | ❌ (unlucky) | ❌ | ❌ No |
| Acme (enterprise) | ❌ | ❌ (unlucky) | ✅ | ✅ Yes |
| Acme (but explicitly removed) | ❌ | ❌ | ❌ (inactive) | ❌ No |

### Code Example

```typescript
export function AIAssistantButton() {
  const hasAccess = useFeatureFlag("aiAssistant");
  
  if (!hasAccess) {
    return (
      <button disabled>
        AI Assistant (coming soon)
      </button>
    );
  }
  
  return (
    <button onClick={openAIAssistant}>
      📧 AI Assistant ✨
    </button>
  );
}
```

---

## Example 5: Conditions + Cohorts + Dependencies (Complex, Phase 3)

**Scenario:** "Advanced Analytics Dashboard" available to:
- Premium users on web
- Who are in either beta_analytics or enterprise cohorts
- AND depends on `reportingV2` feature being enabled first

### Configuration

```json
{
  "featureFlags": {
    "reportingV2": {
      "enabled": true,
      "conditions": {
        "userRole": "premium|admin"
      }
    },
    "analyticsDashboard": {
      "enabled": true,
      "description": "Advanced analytics with real-time insights",
      "kind": "premium",
      "cohorts": ["beta_analytics", "enterprise"],
      "conditions": {
        "platform": "web",
        "userRole": "premium|admin"
      },
      "dependsOn": ["reportingV2"]
    }
  }
}
```

### Resolution Example

For user to see Analytics Dashboard: **ALL** must be true

```
1. enabled: true ✅
   
2. Cohorts check (user in ANY):
   ├─ beta_analytics? (20% of users, seed="analytics_v1")
   │  └─ Check hash: FNV(userId + "beta_analytics" + "analytics_v1") < 20
   └─ enterprise? (100%, explicit)
      └─ Check membership table
   
   Result: User must be in one of these cohorts ✅
   
3. Conditions check (ALL must match):
   ├─ platform == "web" ✅
   └─ userRole == "premium" OR "admin" ✅
   
4. Dependencies check (ALL must be enabled):
   └─ reportingV2 enabled?
      ├─ enabled: true ✅
      └─ userRole check passes ✅
   
Final: true && true && true && true = ✅ ENABLED
```

### Outcomes

| User | Cohort | Platform | Role | ReportV2 | Result |
|------|--------|----------|------|-----------|--------|
| SaaS customer | beta_analytics(✅) | web | premium | enabled | ✅ Yes |
| SaaS customer | beta_analytics(❌) | web | premium | enabled | ❌ No |
| Enterprise | enterprise | android | premium | enabled | ❌ No (wrong platform) |
| Admin (not premium) | admin-test | web | admin | enabled | ✅ Yes |
| OG user | none | web | basic | enabled | ❌ No (wrong cohort + role) |

---

## Testing Checklist for Examples

- [ ] Example 1: Beta tester sees feature, others don't
- [ ] Example 2: Enterprise + web users see feature, mobile doesn't
- [ ] Example 3: Gradual rollout Day 1→2→3 never loses users
- [ ] Example 4: User in ANY of 3 cohorts gets feature
- [ ] Example 5: Complex criteria all enforce AND logic

### Manual Testing Commands

```typescript
// Test Example 1
const user1 = "user-beta-123";
const enabled1 = FeatureFlagsManager.isEnabledWithContext("advancedMaps", {
  platform: "web"
});
console.log(enabled1); // Should be true if explicit in beta_testers

// Test Example 3: Gradual rollout seed consistency
const hash1 = FNV_HASH("user-stable-100" + "reporting_v2_rollout" + "reporting_v2") % 100;
const hash2 = FNV_HASH("user-stable-100" + "reporting_v2_rollout" + "reporting_v2") % 100;
console.log(hash1 === hash2); // Always true (deterministic)
console.log(hash1 < 50); // Same user in Day 2 as Day 1 if hash < 10

// Test Example 4: Multiple cohorts OR logic
const inInternal = FeatureFlagsManager.isEnabledWithContext("aiAssistant", {
  userId: "employee-1"
});
const inBeta = FeatureFlagsManager.isEnabledWithContext("aiAssistant", {
  userId: "random-user"
});
console.log(inInternal || inBeta); // true if in any cohort
```
