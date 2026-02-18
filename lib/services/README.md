# Services

Abstractions for external service integrations and API clients. Provides consistent interfaces for third-party services with error handling and retry logic.

## When to Use This Module

**Use this module if you need to:**
- Integrate with external APIs or services
- Abstract service-specific logic behind consistent interfaces
- Handle service errors and retries uniformly

**Do NOT use this module for:**
- Internal app logic (use other lib modules)
- Direct HTTP requests (use `lib/network`)

## Architecture & Data Flow

```
Component
        ↓
Service Client (e.g., ApiService)
        ↓
lib/network -> HTTP request
        ↓
Parse response / handle errors
```

**Key Principles:**
- **Abstraction**: Service-specific details are hidden behind interfaces.
- **Consistency**: All services follow similar patterns for requests and errors.
- **Resilience**: Built-in retry and error handling for service calls.

## API Reference

### Service Interfaces

Define common interfaces for service clients.

### Service Clients

Concrete implementations for specific services.

## Dependencies

### External Packages
- None specific (depends on services integrated)

### Internal Dependencies
- **`lib/network`** – HTTP client and request handling
- **`lib/error`** – Error handling and categorization

## Error Handling & Edge Cases

### Service Unavailable
Services should handle downtime gracefully with retries and fallbacks.

### Rate Limiting
Implement backoff strategies for rate-limited services.

## Performance Notes

Service calls should be cached where appropriate to reduce external requests.

## Related Modules
- **`lib/network`** – Low-level HTTP and network handling
- **`lib/error`** – Error processing and user feedback

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `provider-adapter.ts` | Defines provider-agnostic interfaces for breadcrumb providers (QueuedBreadcrumb, BreadcrumbSendResult, etc.) |
| `sentry/sentry-adapter.ts` | Sentry-specific implementation of BreadcrumbProvider interface |