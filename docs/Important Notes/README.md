# Important Notes - Documentation Index

High-level reference documentation for D&D Toolkit. Start here for quick answers about components, database, architecture, and development workflows.

---

## 📦 Folders

### [UI/](UI/)

UI-facing reference notes.

- **COMPONENTS.md** - UI components, variants, and dependencies
- **SCREENS.md** - App screen map with purpose notes
- **NAVDRAWER.md** - Drawer behavior across desktop and mobile
- **JOB_OPERATIONS.md** - User-facing operation tracking panel
- **DUAL_PANEL_README.md** - Two-panel navigation behavior

### [Database/](Database/)

Database schema reference and indexes.

- **SCHEMA.md** - Core tables, columns, constraints, and helper functions
- **RLS.md** - Row Level Security policies
- **INDEXES.md** - Performance index reference
- **TRIGGERS.md** - Trigger behavior and automatic updates
- **EDGE_FUNCTIONS.md** - Server-side database entry points

### [Architecture/](Architecture/)

Current system and platform architecture notes.

- **CACHING_POLICY.md** - Data caching strategy (memory, disk, encrypted storage)
- **CSP-Configuration.md** - Current web content security policy note
- **PROVIDER_LAYERS.md** - Provider layering and ownership
- **KERNEL_ARCHITECTURE_ANALYSIS.md** - Bootstrap orchestration and kernel state flow
- **AUTH_AND_SYNC_FLOW.md** - Session restoration, local identity, re-auth, and sync recovery
- **Apps Response to Degraded Paths.md** - Capability degradation and safe-mode escalation
- **ERROR_HANDLING_PATTERN.md** - Centralized error-code and recovery pattern
- **REALTIME_ARCHITECTURE.md** - Realtime behavior and event flow

### [Dev/](Dev/)

Developer workflows and release management.

- **SCRIPTS.md** - All npm scripts (web, desktop, mobile)
- **RELEASES.md** - Release management and versioning guide
- **NOTIFICATIONS.md** - In-app feedback systems and future OS notification fit
- **DESKTOP_APP.md** - Desktop build flow and Electron-specific constraints
- **BARREL_EXPORTS_PATTERN.md** - Preferred public export pattern for reusable modules
- **NETWORK_HEALTH_ENDPOINT.md** - Backend health-check path used by web connectivity detection
- **OFFLINE_SYNC_CONFLICT_FLOW.md** - Current handler metadata and LWW conflict-resolution behavior
- **ROUTING_AUTH_CONFIG.md** - Route-protection config and bootstrap redirect rules

### [Upcoming/](Upcoming/)

Current follow-up notes that are still useful, but not yet promoted into stable reference docs.

- **adaptive-query-integration.md** - Client-side adaptive query rollout plus remaining server-side gaps
- **analytics-consent-followups.md** - Consent UI, crash opt-in UX, and richer privacy-control follow-ups
- **entitlements-lifecycle-followups.md** - Reminder job, renewal flow, and entitlement reminder follow-ups
- **hooks-layer-followups.md** - Shared hook patterns, test helpers, and composition follow-ups
- **kernel-degrade-followups.md** - Remaining advanced kernel phase and degrade-system follow-ups
- **provider-architecture-followups.md** - Provider composition, readiness, testing, and ownership follow-ups
- **offline-sync-followups.md** - Remaining conflict-resolution and handler-contract follow-ups
- **route-authorization-followups.md** - Deferred route-level entitlement or feature-flag gating ideas
- **storage-buckets-and-realtime-backends.md** - Deferred backend adapter work for buckets and realtime
- **theme-system-followups.md** - Motion-token, accessibility, and theme-consistency follow-ups
- **users-api-zod-migration.md** - Concrete schema-first API client migration reminder

## 🚀 Quick Start

**I want to know about...**

- **UI Components** → [UI/COMPONENTS.md](UI/COMPONENTS.md)
- **App Screens** → [UI/SCREENS.md](UI/SCREENS.md)
- **Database Tables** → [Database/SCHEMA.md](Database/SCHEMA.md)
- **Database Indexes** → [Database/INDEXES.md](Database/INDEXES.md)
- **Caching Strategy** → [Architecture/CACHING_POLICY.md](Architecture/CACHING_POLICY.md)
- **Kernel bootstrap** → [Architecture/KERNEL_ARCHITECTURE_ANALYSIS.md](Architecture/KERNEL_ARCHITECTURE_ANALYSIS.md)
- **Auth and sync** → [Architecture/AUTH_AND_SYNC_FLOW.md](Architecture/AUTH_AND_SYNC_FLOW.md)
- **Degraded paths** → [Architecture/Apps%20Response%20to%20Degraded%20Paths.md](Architecture/Apps%20Response%20to%20Degraded%20Paths.md)
- **npm Scripts** → [Dev/SCRIPTS.md](Dev/SCRIPTS.md)
- **Releases** → [Dev/RELEASES.md](Dev/RELEASES.md)
- **Notification systems** → [Dev/NOTIFICATIONS.md](Dev/NOTIFICATIONS.md)
- **Desktop build note** → [Dev/DESKTOP_APP.md](Dev/DESKTOP_APP.md)
- **Barrel export pattern** → [Dev/BARREL_EXPORTS_PATTERN.md](Dev/BARREL_EXPORTS_PATTERN.md)
- **Network health endpoint** → [Dev/NETWORK_HEALTH_ENDPOINT.md](Dev/NETWORK_HEALTH_ENDPOINT.md)
- **Offline sync conflict flow** → [Dev/OFFLINE_SYNC_CONFLICT_FLOW.md](Dev/OFFLINE_SYNC_CONFLICT_FLOW.md)
- **Routing auth config** → [Dev/ROUTING_AUTH_CONFIG.md](Dev/ROUTING_AUTH_CONFIG.md)
- **Analytics consent follow-ups** → [Upcoming/analytics-consent-followups.md](Upcoming/analytics-consent-followups.md)
- **Hooks layer follow-ups** → [Upcoming/hooks-layer-followups.md](Upcoming/hooks-layer-followups.md)
- **Provider architecture follow-ups** → [Upcoming/provider-architecture-followups.md](Upcoming/provider-architecture-followups.md)
- **Entitlements follow-ups** → [Upcoming/entitlements-lifecycle-followups.md](Upcoming/entitlements-lifecycle-followups.md)
- **Storage and realtime backends** → [Upcoming/storage-buckets-and-realtime-backends.md](Upcoming/storage-buckets-and-realtime-backends.md)
- **Theme system follow-ups** → [Upcoming/theme-system-followups.md](Upcoming/theme-system-followups.md)
- **CSP / desktop web security note** → [Architecture/CSP-Configuration.md](Architecture/CSP-Configuration.md)

---

## 📋 Organization Notes

- Files are organized by topic (UI, Database, Architecture, Dev)
- Use this index as the main entry point instead of adding wrapper READMEs in every folder
- Keep notes concise and only keep files that still help current work

---

## See Also

- For detailed implementation and issue-era writeups, see `docs/issues/`
- For component examples and best practices, see `lib/README.md`
- For testing guides, see `docs/A Testing Guide/`