# Frontend Gating (UI Components)

How to gate React components, pages, and UI elements using feature flags and premium checks.

## Quick Reference

```tsx
import { FeatureGate } from '@/components/ui';

// Feature flag only
<FeatureGate flag="themeSelector">
  <ThemeSelector />
</FeatureGate>

// Premium only
<FeatureGate requirePremium featureKey="advanced_theme">
  <AdvancedThemeOptions />
</FeatureGate>

// Combined (flag AND premium)
<FeatureGate flag="campaignsBeta" requirePremium featureKey="campaigns">
  <CampaignsPanel />
</FeatureGate>
```

## FeatureGate Component

**Props:**
- `flag?: FeatureFlagName` – Feature flag to check
- `requirePremium?: boolean` – Require premium tier
- `featureKey?: string` – Specific premium feature key (only with `requirePremium`)
- `fallback?: ReactNode` – Optional fallback (defaults to `null` = invisible)
- `children: ReactNode` – Content to gate

**Behavior:**
- Renders children only if **all** checks pass
- Shows `fallback` (or nothing) when gated
- Handles loading states automatically
- Dev warning if `featureKey` provided without `requirePremium`

### Examples

#### Gate a Single Component
```tsx
<FeatureGate flag="customDice">
  <DiceRoller />
</FeatureGate>
```

#### Gate an Entire Page
```tsx
export default function CampaignsPage() {
  return (
    <FeatureGate flag="campaignsBeta" requirePremium featureKey="campaigns">
      <View style={{ flex: 1 }}>
        <CampaignsHeader />
        <CampaignsList />
      </View>
    </FeatureGate>
  );
}
```

#### Show Fallback Instead of Hiding
```tsx
<FeatureGate 
  flag="advancedSearch" 
  fallback={<Text>Basic search only</Text>}
>
  <AdvancedSearchPanel />
</FeatureGate>
```

#### Multiple Gates on Same Page
```tsx
<View>
  <FeatureGate flag="themeSelector">
    <ThemeSelector />
  </FeatureGate>
  
  <FeatureGate requirePremium featureKey="custom_fonts">
    <FontPicker />
  </FeatureGate>
  
  <SettingsPanel /> {/* Always visible */}
</View>
```

## Hooks

### useFeatureFlag
Direct access to feature flags in your component logic.

```tsx
import { useFeatureFlag } from '@/hooks/use-feature-flag';

function MyComponent() {
  const showAdvanced = useFeatureFlag('advancedMode');
  
  return (
    <View>
      <BasicControls />
      {showAdvanced && <AdvancedControls />}
    </View>
  );
}
```

**Note:** Recomputes on every render to support runtime toggles via `FeatureFlags.toggle()`.

### usePremiumFeature
Check premium tier and feature entitlements with loading state.

```tsx
import { usePremiumFeature } from '@/hooks/use-premium-feature';

function ProfileScreen() {
  const { isPremium, isAvailable, loading } = usePremiumFeature('extended_storage');
  
  if (loading) return <LoadingSpinner />;
  
  const storageQuota = isAvailable ? '10GB' : '100MB';
  
  return (
    <View>
      <Text>Storage: {storageQuota}</Text>
      {isPremium && <PremiumBadge />}
    </View>
  );
}
```

**Params:**
- `featureKey?: string` – Optional specific feature to check
- If `undefined`, only checks `isPremium` (no loading state)

**Returns:**
- `isPremium: boolean` – True if user has premium tier
- `isAvailable: boolean` – True if feature is accessible
- `loading: boolean` – True while fetching subscription state

## Patterns

### Conditional Feature Lists
```tsx
function FeaturesList() {
  const hasAdvanced = useFeatureFlag('advancedFeatures');
  const { isPremium } = usePremiumFeature();
  
  return (
    <View>
      <FeatureItem title="Basic Tools" />
      <FeatureItem title="Templates" />
      
      {hasAdvanced && <FeatureItem title="Automation" />}
      {isPremium && <FeatureItem title="Priority Support" />}
    </View>
  );
}
```

### Gate Navigation Items
```tsx
function NavigationMenu() {
  return (
    <View>
      <NavItem to="/home" label="Home" />
      <NavItem to="/characters" label="Characters" />
      
      <FeatureGate flag="campaignsBeta">
        <NavItem to="/campaigns" label="Campaigns" />
      </FeatureGate>
      
      <FeatureGate requirePremium featureKey="analytics">
        <NavItem to="/analytics" label="Analytics" />
      </FeatureGate>
    </View>
  );
}
```

### Progressive Disclosure
```tsx
function SettingsPanel() {
  const showExperimental = useFeatureFlag('experimentalSettings');
  
  return (
    <View>
      <SettingGroup title="General">
        <ThemeSetting />
        <LanguageSetting />
      </SettingGroup>
      
      {showExperimental && (
        <SettingGroup title="⚠️ Experimental">
          <BetaFeatureSetting />
        </SettingGroup>
      )}
    </View>
  );
}
```

## Tips

- **No visual pollution:** Gated features are invisible by default (no "upgrade" banners)
- **Lazy loading:** Wrap entire route components for beta/premium pages
- **Fallbacks:** Use sparingly; prefer invisible gating for cleaner UX
- **Dev console:** `window.FeatureFlags.toggle('flagName', true)` to test flags
- **Loading states:** `FeatureGate` handles them automatically; hooks expose `loading` for custom UI
