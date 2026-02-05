# Feature Flag Remote Overrides - Usage Guide

## Overview

Remote overrides allow administrators to control feature flags on a per-user basis, overriding both server defaults and local configurations. This is primarily used for QA testing and targeted feature rollouts.

## How It Works

Feature flags are resolved in this priority order (highest to lowest):
1. **Remote Override** (per-user, admin-controlled)
2. **Local Override** (admin testing/debugging)
3. **Server Flag** (global feature flag)
4. **Hardcoded Fallback** (from `appsettings.*.json`)

## For Administrators

### Setting Up Remote Overrides

Remote overrides are managed through the Supabase admin panel in the `feature_flag_overrides` table.

#### Database Schema

```sql
CREATE TABLE feature_flag_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### Required Fields
- `user_id`: The user's UUID from Supabase auth
- `flag_name`: Name of the feature flag to override
- `enabled`: Override value (true/false)
- `expires_at`: Optional expiration date (null = never expires)
- `revoked`: Set to true to disable the override

### Common Use Cases

#### QA Testing
```sql
-- Enable experimental feature for QA tester
INSERT INTO feature_flag_overrides (user_id, flag_name, enabled)
VALUES ('qa-user-uuid', 'experimentalFeature', true);
```

#### Temporary Feature Rollout
```sql
-- Enable feature for beta users with 30-day expiration
INSERT INTO feature_flag_overrides (user_id, flag_name, enabled, expires_at)
VALUES ('beta-user-uuid', 'newFeature', true, NOW() + INTERVAL '30 days');
```

#### Emergency Disable
```sql
-- Disable problematic feature for specific user
INSERT INTO feature_flag_overrides (user_id, flag_name, enabled, revoked)
VALUES ('user-uuid', 'problematicFeature', false, true);
```

## For Developers

### Checking Override Status

Use the `FeatureFlagsManager` to check flag values:

```typescript
import { FeatureFlagsManager } from '@/lib/feature-flags/server-sync';

// Check if feature is enabled (includes override logic)
const isEnabled = FeatureFlagsManager.getFlag('myFeature', false);
```

### Debugging Overrides

Enable debug logging to see override resolution:

```typescript
// In development console or via feature flag
FeatureFlagsManager.setOverride('debugLogs', true);
```

This will log override resolution in the console:
```
[feature_flags] Flag myFeature from remote override: true
```

### Testing Overrides

In development, you can simulate overrides:

```typescript
// Simulate remote override for testing
FeatureFlagsManager.setOverride('testFlag', true);
const value = FeatureFlagsManager.getFlag('testFlag', false); // returns true
```

## Environment Behavior

### Development
- Uses `appsettings.dev.json` as source of truth
- **No remote fetching** (including overrides)
- Local overrides only for debugging

### Production
- Server feature flags as source of truth
- Remote overrides fetched and applied per user
- Cached for offline use

## Best Practices

### For Admins
1. **Always set expiration dates** for temporary overrides
2. **Use revocation instead of deletion** for audit trails
3. **Test overrides** before applying to production users
4. **Document override purposes** in admin notes

### For Developers
1. **Use descriptive flag names** that indicate purpose
2. **Test both enabled/disabled states** in development
3. **Handle flag changes gracefully** in components
4. **Log feature usage** for analytics

## Troubleshooting

### Override Not Working
1. Check if override is **revoked** (`revoked = false`)
2. Check if override is **expired** (`expires_at > NOW()` or `null`)
3. Verify **user_id** matches exactly
4. Check **flag_name** spelling
5. Clear app cache and restart

### Performance Issues
- Overrides are cached locally after first fetch
- No additional network calls after bootstrap
- Cached overrides persist across app restarts

### Cache Issues
```typescript
// Force refresh (development only)
await FeatureFlagsManager.initialize(supabaseClient, userId);
await FeatureFlagsManager.bootstrapFlags();
```</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 1\057 - User Specific Feature Flag Overrides\USAGE_GUIDE.md