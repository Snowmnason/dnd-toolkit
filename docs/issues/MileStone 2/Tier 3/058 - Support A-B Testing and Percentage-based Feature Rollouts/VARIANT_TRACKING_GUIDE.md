# Variant Tracking (A/B Testing Analytics)

This is the **groundwork** for A/B testing and variant analytics in the D&D Toolkit. Use this to track which variant (A or B) users are assigned to and how they engage with variant features.

## Overview

The system automatically tracks:
1. **Variant Assignment** - Which variant (A or B) each user is assigned to when evaluating rollouts or route variants
2. **User Engagement** - How users interact with variant-controlled features
3. **Performance Metrics** - Performance differences between variants

## Quick Start

### For Components Using Variants

```tsx
import { useVariantTracking } from '@/hooks';

export function CharactersV2Screen() {
  const { trackEngagement } = useVariantTracking('characters_v2_screen', 'B');

  return (
    <Button
      onPress={() => {
        trackEngagement('edit_button_clicked');
        // ... handle click
      }}
    >
      Edit
    </Button>
  );
}
```

### For Manual Tracking

```ts
import { trackVariantEngagement, trackVariantPerformance } from '@/lib/analytics';

// Track a user action
trackVariantEngagement({
  flagName: 'dark_mode_v2',
  variant: 'B',
  action: 'toggle_enabled',
  userId: 'user-123',
});

// Track performance
trackVariantPerformance({
  flagName: 'api_v2_endpoint',
  variant: 'B',
  userId: 'user-123',
  metric: 'api_response_ms',
  value: 245,
});
```

## Architecture

### Automatic Tracking

Variant assignments are **automatically tracked** when:
- `evaluateRouteVariant()` is called (route variants)
- `evaluateRollout()` is called in feature flags (rollout variants)

No manual work needed for assignment tracking.

### Manual Tracking

Use these for engagement and performance:
- `trackVariantEngagement()` - User actions (clicks, form submissions, etc.)
- `trackVariantPerformance()` - Performance metrics per variant
- `useVariantTracking()` hook - Component-level tracking helper

## Module Structure

```
lib/analytics/
├── variant-tracking.ts      # Core tracking functions
│   ├── trackVariantAssignment()     # Auto-called by rollout system
│   ├── trackVariantEngagement()     # Manual: user interactions
│   └── trackVariantPerformance()    # Manual: performance metrics
├── index.ts                 # Exports Analytics, Performance, etc.
└── ...

hooks/
├── use-variant-tracking.ts  # React hook for components
└── ...
```

## Events Sent to Sentry

All events are tracked via the existing `Analytics.track()` system and sent to Sentry as breadcrumbs:

### Event: `variant_assigned`
Fired when user is assigned to a variant (automatic).

```ts
{
  flag_name: string;
  variant: 'A' | 'B' | string;
  percentage?: number;
  route_path?: string;
  rollout_type?: 'feature_flag';
}
```

### Event: `variant_engagement`
Fired when user interacts with variant feature (manual).

```ts
{
  flag_name: string;
  variant: 'A' | 'B' | string;
  action: string;  // e.g., 'view', 'click', 'submit'
  [custom_fields]: any;
}
```

### Event: `variant_performance`
Fired to track performance metrics per variant (manual).

```ts
{
  flag_name: string;
  variant: 'A' | 'B' | string;
  metric: string;   // e.g., 'screen_load_ms'
  value: number;
}
```

## Privacy & Consent

- All tracking respects `AnalyticsConsent` settings
- User IDs are recorded as-is (no additional hashing)
- Consider anonymizing user IDs before sending to external analytics if needed

## Future Enhancements

This groundwork enables:

1. **Batch Event Collection**
   - Collect events locally and send in batches
   - Reduce analytics overhead for high-frequency events

2. **Goal/Conversion Tracking**
   - Track specific user goals (e.g., "completed dungeon")
   - Measure conversion rate difference between variants

3. **Statistical Significance**
   - Calculate if variant B is statistically better than A
   - Auto-detect winner and roll out to 100%

4. **Engagement Heatmaps**
   - Visualize where variant B users click vs. variant A
   - Identify UX differences

5. **A/B Test Dashboard**
   - Real-time stats per variant
   - Conversion funnel visualization
   - Winner determination and rollout actions

## Example: A/B Testing a New Screen

```tsx
// 1. Define variant in route config
// lib/navigation/routes/main-routes.ts
export const characterScreenConfig: RouteConfig = {
  path: '/main/characters',
  title: 'Characters',
  variants: {
    A: { percentage: 50, title: 'Characters (Original)' },
    B: { percentage: 50, title: 'Characters (New)' },
  },
  defaultVariant: 'A',
};

// 2. Component uses variant
// app/main/characters/index.tsx
export function CharactersScreen() {
  const variant = useVariant(); // Get variant from route
  const { trackEngagement } = useVariantTracking('characters_screen', variant);

  React.useEffect(() => {
    trackEngagement('screen_viewed');
  }, []);

  return variant === 'B' ? <CharactersV2 /> : <CharactersV1 />;
}

// 3. Track actions
function CharacterCard({ character }) {
  const { trackEngagement } = useVariantTracking('characters_screen', 'B');

  return (
    <Card
      onPress={() => {
        trackEngagement('character_tapped', {
          character_id: character.id,
        });
        navigate('character_details', { id: character.id });
      }}
    >
      {character.name}
    </Card>
  );
}

// 4. Check Sentry for results
// After running both variants for ~1 week:
// - variant_engagement events show interaction patterns
// - variant_assigned shows ~50/50 distribution
// - Decide: is B better? Roll out to 100% or revert to A
```

## Troubleshooting

### Events not appearing in Sentry
- Check `AnalyticsConsent.isAllowed('usage')` is true
- Verify Sentry is enabled in `config/appsettings.json`
- Check browser console for errors (web platform)

### User ID missing in events
- `useVariantTracking` requires `useUserId()` from context
- Manual calls require passing `userId` parameter

### Events appearing but with wrong data
- Ensure you're passing the correct `flagName` and `variant`
- Check that `trackEngagement` is called after component mounts

## Related

- [Feature Flags System](../feature-flags/README.md) - Rollout configuration
- [Analytics Module](./analytics/README.md) - Sentry integration
- [Navigation Config](../navigation/README.md) - Route variant definition
