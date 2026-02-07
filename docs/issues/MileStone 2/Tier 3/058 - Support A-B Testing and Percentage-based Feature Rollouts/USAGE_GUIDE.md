# Usage Guide: A/B Testing and Percentage-Based Feature Rollouts

This guide shows how to use the rollout system for gradual feature deployment, A/B testing, and user segmentation.

## Quick Start

### Basic Feature Rollout

```typescript
import { FeatureFlagsManager } from '@/lib/feature-flags';

// Check if user is in 25% rollout for new feature
const isInRollout = await FeatureFlagsManager.evaluateRollout(
  userId,
  'new_feature_name',
  false // fallback if no rollout configured
);

if (isInRollout) {
  // Show new feature
  return <NewFeatureComponent />;
} else {
  // Show old feature
  return <LegacyFeatureComponent />;
}
```

### Route-Based A/B Testing

```typescript
import { evaluateRouteVariant } from '@/lib/navigation/navigation-config';

const CharactersScreen = () => {
  const userId = useUserId();
  const [variant, setVariant] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      const config = getRouteConfig({
        segments: ['main', 'characters'],
        params: {},
        router,
        isMobile: false
      });
      const v = await evaluateRouteVariant(config, userId);
      setVariant(v);
    })();
  }, [userId]);

  if (variant === 'v2') {
    return <CharactersScreenV2 />;
  }
  return <CharactersScreenV1 />;
};
```

## Rollout Configuration

### Database Setup

Rollouts are configured in the `feature_flag_rollouts` table:

```sql
-- Example: Roll out new feature to 10% of users
INSERT INTO feature_flag_rollouts (
  flag_name,
  percentage,
  seed,
  description,
  is_active
) VALUES (
  'new_feature_name',
  10,
  '2026-02-07', -- Optional seed for rebalancing
  'Gradual rollout of new feature',
  true
);
```

### Route Variants

Configure route variants in navigation config:

```typescript
export const charactersRoute: RouteConfig = {
  path: '/main/characters',
  title: 'Characters',
  variants: {
    'v1': {
      id: 'v1',
      percentage: 90,
      title: 'Characters (Legacy)',
      metadata: { version: '1.0' }
    },
    'v2': {
      id: 'v2',
      percentage: 10,
      title: 'Characters (New)',
      metadata: { version: '2.0' }
    },
  },
  defaultVariant: 'v1',
};
```

## Common Patterns

### Gradual Rollout

```typescript
// Start with 5% rollout
const rolloutPercent = 5;
const isEnabled = await FeatureFlagsManager.evaluateRollout(
  userId,
  'feature_name',
  false
);

// Gradually increase percentage over time
// 5% → 10% → 25% → 50% → 100%
```

### A/B Testing

```typescript
const variant = await FeatureFlagsManager.evaluateRollout(
  userId,
  'ui_test_variant_b',
  false
) ? 'B' : 'A';

// Track analytics
analytics.track('ui_test_viewed', {
  variant,
  userId,
  timestamp: Date.now()
});
```

### Feature Gates

```typescript
// Premium feature with gradual rollout
const hasEntitlement = await FeatureFlagsManager.getEntitlement('premium', userId);
const isInRollout = await FeatureFlagsManager.evaluateRollout(
  userId,
  'premium_feature',
  false
);

if (hasEntitlement.granted && isInRollout) {
  return <PremiumFeature />;
}
```

## Offline Behavior

Rollouts work offline using cached configuration:

- Rollout configs are cached during app bootstrap
- Cached in `SecureStorage` under `FEATURE_FLAGS:rollouts`
- Survives app restarts and network issues
- Updates when network is available

## Analytics Integration

Track rollout effectiveness:

```typescript
const isInRollout = await FeatureFlagsManager.evaluateRollout(
  userId,
  'new_feature',
  false
);

// Track feature usage
if (isInRollout) {
  analytics.track('feature_used', {
    feature: 'new_feature',
    userId,
    timestamp: Date.now()
  });
}
```

## Best Practices

### Rollout Strategy

1. **Start Small**: Begin with 1-5% rollout
2. **Monitor Metrics**: Watch error rates, performance, user feedback
3. **Gradual Increase**: Double rollout percentage every few days
4. **Full Rollout**: 100% when confident
5. **Rollback Ready**: Keep old code path available

### Testing

```typescript
// Test rollout logic
import { isInRollout } from '@/lib/feature-flags/rollout';

// Deterministic: same user always gets same result
expect(isInRollout('user123', 'test_flag', 50)).toBe(true);
expect(isInRollout('user123', 'test_flag', 50)).toBe(true); // Same result
```

### Seeds for Rebalancing

```sql
-- Use seed to rebalance users without changing percentages
UPDATE feature_flag_rollouts
SET seed = '2026-02-08'
WHERE flag_name = 'feature_name';
```

This moves users between rollout groups while maintaining percentages.</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 1\058 - Support A-B Testing and Percentage-based Feature Rollouts\USAGE_GUIDE.md