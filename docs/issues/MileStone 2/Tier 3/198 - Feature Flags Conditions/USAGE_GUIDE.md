# Feature Flags Conditions - Usage Guide

## Overview

Feature flags conditions allow you to control when feature flags are enabled based on runtime context. The system supports both simple AND-based conditions and advanced logical expressions with OR/NOT operators.

## Basic Concepts

### Flag Context

All condition evaluation uses a `FlagContext` object that provides runtime information:

```typescript
interface FlagContext {
  platform?: string;    // 'web' | 'ios' | 'android' | 'desktop'
  environment?: string; // 'development' | 'production'
  userRole?: string;    // Role name (e.g., 'admin', 'premium_user')
}
```

### Condition Types

The system supports several built-in condition types:

- **platform**: Match specific platforms
- **environment**: Match development/production
- **userRole**: Match user roles/entitlements
- **time**: Time-based conditions (hour, day, date ranges)
- **custom**: Plugin-based custom evaluators

## Simple Conditions (Phase 1)

Simple conditions use AND logic - all specified conditions must be true.

### Configuration

```json
{
  "featureFlags": {
    "advancedMaps": {
      "enabled": true,
      "conditions": {
        "platform": "web",
        "environment": "production",
        "userRole": "premium_user"
      }
    }
  }
}
```

### Behavior

- **platform**: Flag only enabled on web platform
- **environment**: Flag only enabled in production
- **userRole**: Flag only enabled for premium users
- **All conditions AND-ed**: Must be web + production + premium user

### Usage in Code

```typescript
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";

// Automatic context detection
const isEnabled = FeatureFlagsManager.isEnabled("advancedMaps");

// Or provide explicit context
const context = {
  platform: "web",
  environment: "production",
  userRole: "premium_user"
};
const isEnabled = FeatureFlagsManager.isEnabledWithContext("advancedMaps", context);
```

## Advanced Conditions (Phase 3)

Advanced conditions support nested logical expressions with AND, OR, and NOT operators.

### Configuration Examples

#### OR Logic - Enable for admins OR premium users

```json
{
  "featureFlags": {
    "adminPanel": {
      "enabled": true,
      "conditionLogic": {
        "operator": "OR",
        "conditions": [
          { "type": "userRole", "value": "admin" },
          { "type": "userRole", "value": "premium_user" }
        ]
      }
    }
  }
}
```

#### NOT Logic - Enable for everyone EXCEPT mobile

```json
{
  "featureFlags": {
    "desktopOnly": {
      "enabled": true,
      "conditionLogic": {
        "operator": "NOT",
        "condition": {
          "type": "platform",
          "value": "mobile"
        }
      }
    }
  }
}
```

#### Complex Nested Logic - Web + (Admin OR Premium) + Business Hours

```json
{
  "featureFlags": {
    "advancedAnalytics": {
      "enabled": true,
      "conditionLogic": {
        "operator": "AND",
        "conditions": [
          { "type": "platform", "value": "web" },
          {
            "operator": "OR",
            "conditions": [
              { "type": "userRole", "value": "admin" },
              { "type": "userRole", "value": "premium_user" }
            ]
          },
          {
            "type": "time",
            "config": {
              "hour": [9, 17],
              "dayOfWeek": [1, 2, 3, 4, 5]
            }
          }
        ]
      }
    }
  }
}
```

### Time-Based Conditions

Time conditions support various time-based criteria:

```json
{
  "type": "time",
  "config": {
    "hour": 14                    // Exact hour (2 PM)
  }
}
```

```json
{
  "type": "time",
  "config": {
    "hour": [9, 17]              // Range: 9 AM to 5 PM
  }
}
```

```json
{
  "type": "time",
  "config": {
    "dayOfWeek": [1, 2, 3, 4, 5] // Monday-Friday (1=Monday)
  }
}
```

```json
{
  "type": "time",
  "config": {
    "startDate": "2024-12-25T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  }
}
```

## Custom Conditions with Plugins

For complex business logic, register custom condition evaluators:

### Registering a Plugin

```typescript
import { pluginRegistry } from "@/lib/feature-flags/advanced-conditions";

// Register at app startup (in AppKernel or similar)
pluginRegistry.register({
  name: "userAttribute:department",
  matcher: (type, evaluator) =>
    type === "custom" && evaluator === "userAttribute:department",
  evaluate: (condition, context) => {
    const userDept = getCurrentUserDepartment(); // Your business logic
    return userDept === condition.config?.value;
  }
});
```

### Using Custom Conditions

```json
{
  "featureFlags": {
    "engineeringTools": {
      "enabled": true,
      "conditionLogic": {
        "operator": "AND",
        "conditions": [
          { "type": "platform", "value": "web" },
          {
            "type": "custom",
            "evaluator": "userAttribute:department",
            "config": { "value": "engineering" }
          }
        ]
      }
    }
  }
}
```

## React Hooks Usage

### Basic Flag Check

```typescript
import { useFeatureFlag } from "@/lib/feature-flags/hooks";

function MyComponent() {
  const isAdvancedMapsEnabled = useFeatureFlag("advancedMaps");

  return (
    <div>
      {isAdvancedMapsEnabled && <AdvancedMapComponent />}
    </div>
  );
}
```

### Context-Aware Flag Check

```typescript
import { useFeatureFlags } from "@/lib/feature-flags/hooks";

function MyComponent() {
  const flags = useFeatureFlags();

  // Context automatically provided by hooks
  const isEnabled = flags.isEnabled("advancedMaps");

  return (
    <div>
      {isEnabled && <AdvancedMapComponent />}
    </div>
  );
}
```

### Entitlement Check

```typescript
import { useEntitlement } from "@/lib/feature-flags/hooks";

function PremiumFeature() {
  const hasPremium = useEntitlement("premium");

  return (
    <div>
      {hasPremium ? <PremiumContent /> : <UpgradePrompt />}
    </div>
  );
}
```

## Configuration Patterns

### Platform-Specific Features

```json
{
  "featureFlags": {
    "touchGestures": {
      "enabled": true,
      "conditionLogic": {
        "operator": "OR",
        "conditions": [
          { "type": "platform", "value": "ios" },
          { "type": "platform", "value": "android" }
        ]
      }
    }
  }
}
```

### Beta Features for Admins Only

```json
{
  "featureFlags": {
    "betaFeature": {
      "enabled": true,
      "kind": "beta",
      "conditions": {
        "userRole": "admin",
        "environment": "development"
      }
    }
  }
}
```

### Gradual Rollout with Time Windows

```json
{
  "featureFlags": {
    "newUI": {
      "enabled": true,
      "conditionLogic": {
        "operator": "AND",
        "conditions": [
          { "type": "userRole", "value": "premium_user" },
          {
            "type": "time",
            "config": {
              "startDate": "2024-12-01T00:00:00Z",
              "endDate": "2024-12-31T23:59:59Z"
            }
          }
        ]
      }
    }
  }
}
```

## Best Practices

### Condition Design

1. **Start Simple**: Use simple conditions for basic requirements
2. **Progressive Complexity**: Add advanced logic only when needed
3. **Clear Naming**: Use descriptive custom evaluator names
4. **Test Conditions**: Use admin tooling to simulate different contexts

### Performance Considerations

1. **Cache Results**: The system automatically caches condition evaluations
2. **Avoid Deep Nesting**: Keep condition trees shallow (max 3-4 levels)
3. **Plugin Efficiency**: Custom evaluators should be fast (database calls OK if cached)

### Maintenance

1. **Document Custom Evaluators**: Keep business logic well-documented
2. **Version Plugins**: Consider versioning custom evaluator interfaces
3. **Monitor Usage**: Use telemetry to track condition evaluation patterns

## Troubleshooting

### Flag Not Enabling

1. Check context values match condition requirements
2. Verify user roles/entitlements are correctly cached
3. Use admin tooling to simulate contexts
4. Check for validation errors in logs

### Performance Issues

1. Review condition complexity with admin tooling
2. Check telemetry for slow evaluations
3. Consider simplifying complex nested conditions

### Custom Plugin Issues

1. Verify plugin registration at startup
2. Check plugin matcher logic
3. Ensure evaluator returns boolean values
4. Review error handling in custom logic