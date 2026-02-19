# Services

Abstractions for external service integrations, API clients, and analytics exporters. Provides consistent interfaces for third-party services and pluggable backends with error handling and retry logic.

## When to Use This Module

**Use this module if you need to:**
- Integrate with external APIs or services
- Abstract service-specific logic behind consistent interfaces
- Handle service errors and retries uniformly
- Implement pluggable analytics exporters
- Create provider adapters for different backends

**Do NOT use this module for:**
- Internal app logic (use other lib modules)
- Direct HTTP requests (use `lib/network`)

## Architecture & Data Flow

```
Component
        ↓
Service Client (e.g., ApiService) or Analytics Exporter (e.g., SentryExporter)
        ↓
lib/network -> HTTP request or Provider-specific API
        ↓
Parse response / handle errors / queue for retry
```

**Key Principles:**
- **Abstraction**: Service-specific and provider-specific details are hidden behind interfaces.
- **Consistency**: All services and exporters follow similar patterns for requests, exports, and errors.
- **Pluggability**: Analytics exporters can be swapped or added without changing core logic.

## API Reference

### Service Interfaces

Define common interfaces for service clients.

### Analytics Exporter Interfaces

Define interfaces for pluggable analytics exporters:

- `AnalyticsExporter` — Contract for custom analytics backends
- `QueuedBreadcrumb` — Breadcrumb structure for offline queuing
- `BreadcrumbProvider` — Interface for breadcrumb delivery providers
- `BreadcrumbSendResult` — Result of sending breadcrumbs

### Service Clients

Concrete implementations for specific services.

### Analytics Exporters

Concrete implementations for analytics backends:

- `SentryAdapter` — Sentry-specific breadcrumb provider
- Future: `MixpanelExporter`, `SegmentExporter`, etc.

## Dependencies

### External Packages
- None specific (depends on services integrated)

### Internal Dependencies
- **`lib/network`** – HTTP client and request handling
- **`lib/error`** – Error handling and categorization
- **`lib/analytics`** – Analytics event types and exporter interfaces

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
- **`lib/analytics`** – Analytics system that uses service exporters

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `provider-adapter.ts` | Defines provider-agnostic interfaces for breadcrumb providers (QueuedBreadcrumb, BreadcrumbSendResult, etc.) |
| `sentry/sentry-adapter.ts` | Sentry-specific implementation of BreadcrumbProvider interface |