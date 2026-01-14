# Logger System with Categories and Filtering

## Overview

The logger system has been enhanced with category-based filtering to provide better control over logging output during development and debugging.

## Features

- **Category-based filtering**: Enable/disable logs by category (auth, navigation, api, performance, etc.)
- **Level filtering**: Control log levels (debug, info, warn, error)
- **Backwards compatibility**: Existing logger calls continue to work
- **Configuration-driven**: Categories and levels controlled via feature flags

## Categories

| Category | Description | Use Case |
|----------|-------------|----------|
| `auth` | Authentication and session management | Login flows, token handling |
| `navigation` | Navigation and routing | Screen transitions, deep links |
| `api` | API requests and network calls | HTTP requests, responses |
| `performance` | Performance monitoring and timing | Slow operations, measurements |
| `storage` | Data storage and caching | Database operations, cache hits/misses |
| `ui` | UI components and rendering | Component lifecycle, rendering issues |
| `analytics` | Analytics and tracking | Event tracking, user behavior |
| `security` | Security-related operations | Permission checks, encryption |
| `bootstrap` | App initialization and startup | Loading, configuration |
| `error` | Error handling and reporting | Exceptions, error recovery |
| `other` | Miscellaneous logs | Catch-all for uncategorized logs |

## Usage

### Basic Usage (Backwards Compatible)

```typescript
import { logger } from '@/lib/utils/logger';

// Old style still works
logger.info('auth', 'User logged in');
logger.warn('api', 'Slow request detected');
logger.error('security', 'Permission denied');
```

### Category-Specific Logger (Recommended)

```typescript
import { logger } from '@/lib/utils/logger';

// Get a category-specific logger
const authLogger = logger.category('auth');
const apiLogger = logger.category('api');

// Cleaner API
authLogger.info('User logged in successfully');
authLogger.warn('Session expired');

apiLogger.error('Request failed', { status: 500, url: '/api/users' });
```

### Structured Logging

```typescript
// With context and structured data
logger.info('api', 'User fetch completed', {
  userId: '123',
  duration: 150,
  cacheHit: true
});

// Performance monitoring
logger.category('performance').warn('Slow render detected', {
  component: 'UserList',
  renderTime: 2500,
  itemCount: 100
});
```

## Configuration

Categories are controlled via feature flags in `config/appsettings.dev.json` and `config/appsettings.json`.

### Development Configuration

```json
{
  "featureFlags": {
    "loggerCategories": {
      "enabled": true,
      "categories": {
        "auth": true,
        "navigation": true,
        "api": true,
        "performance": true,
        "storage": true,
        "ui": true,
        "analytics": true,
        "security": true,
        "bootstrap": true,
        "error": true,
        "other": true
      }
    }
  }
}
```

### Production Configuration

```json
{
  "featureFlags": {
    "loggerCategories": {
      "enabled": true,
      "categories": {
        "auth": false,
        "navigation": false,
        "api": false,
        "performance": false,
        "storage": false,
        "ui": false,
        "analytics": false,
        "security": true,
        "bootstrap": false,
        "error": true,
        "other": false
      }
    }
  }
}
```

## Filtering During Development

To focus on specific issues, disable categories you're not interested in:

```json
{
  "loggerCategories": {
    "categories": {
      "auth": false,        // Disable auth logs
      "navigation": false,  // Disable navigation logs
      "api": true,          // Keep API logs
      "performance": true,  // Keep performance logs
      // ... other categories
    }
  }
}
```

## Migration Guide

### Existing Code

No changes required - existing logger calls continue to work:

```typescript
// This still works
logger.info('old-context', 'Message');
```

### Recommended Migration

Update to use categories:

```typescript
// Before
logger.info('request-manager', 'Slow request detected');

// After
logger.info('api', 'Slow request detected');
// or
logger.category('api').info('Slow request detected');
```

### Batch Migration

Use find/replace to update common patterns:

- `'request-manager'` → `'api'`
- `'auth-state'` → `'auth'`
- `'performance'` (already correct)
- `'usersDB'` → `'storage'`
- `'worlds'` → `'storage'`

## Best Practices

1. **Use categories consistently**: Choose the most appropriate category for each log
2. **Include structured data**: Pass objects for complex data instead of string concatenation
3. **Use category loggers**: `logger.category('auth')` for cleaner code
4. **Keep context meaningful**: Use descriptive context strings when needed
5. **Don't log sensitive data**: Avoid logging passwords, tokens, or PII

## Output Format

```
[15:42:37] [PERFORMANCE] ⚠️ Slow render detected { component: 'UserList', renderTime: 2500 }
[15:42:38] [API] ℹ️ Request completed in 150ms
[15:42:39] [AUTH] ❌ Login failed: invalid credentials
```

Format: `[timestamp] [CATEGORY] emoji message`</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 1\108 - Improve Logger System with Categories and Filtering\LOGGER_SYSTEM.md