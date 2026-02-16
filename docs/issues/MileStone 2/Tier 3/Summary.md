# Tier 3 Summary (Milestone 2)

This document is a **high-level orientation** for the Tier 3 configuration + feature-control system.

It is intentionally concise and primarily points to the existing issue docs for deeper, implementation-level detail.

## What Tier 3 Adds

Tier 3 turns feature control from “local config toggles” into a **server-driven, event-updating system**:

- **Single consolidated bootstrap**: the client fetches flags/entitlements/overrides (and related context) in one call.
- **Realtime updates**: changes propagate without app restart via Supabase Realtime.
- **Offline continuity**: the last known good state is cached so the app behaves predictably offline.
- **Clear precedence**: overrides win over server values, which win over hardcoded defaults.
- **Schema/versioning discipline**: config + payloads evolve safely with validation and migrations.

## Mental Model

Think of Tier 3 as three layers:

1. **Local defaults** (baseline)
   - Source: `config/appsettings.json` / `config/appsettings.dev.json`
   - Use: safe defaults, dev-only behavior, and fallback when server is unavailable.

2. **Server state** (authoritative)
   - Source: Supabase Edge Function `get_feature_flags` and the backing tables
   - Use: real flags, entitlements, cohorts, rollouts, overrides.

3. **Overrides** (highest priority)
   - Local overrides (developer/admin testing)
   - Remote per-user overrides (admin-controlled)

## Feature Flags vs Entitlements

Tier 3 intentionally treats “flags” and “entitlements” as related but distinct concepts:

- **Feature flags** answer: “Should this feature behavior be on for this user *right now*?”
   - Examples: enable a beta UI panel, turn on an experimental workflow, increase a limit for a cohort.
   - Flags can be conditional (platform/role/world), cohort-based, or rollout-based.

- **Entitlements** answer: “Is this user allowed to access this premium capability?”
   - Examples: premium-only screens, exporting tools, higher quotas.
   - Entitlements typically must be handled more conservatively than flags (prefer fail-secure when access control is involved).

In practice: flags are great for product iteration and gradual releases; entitlements are for access gating.

## Feature Flags System Overview

**Core runtime entrypoints:**
- Tier 3 manager: `lib/feature-flags/server-sync.ts`
- Legacy/local flags: `lib/feature-flags/feature-flags.ts` (appsettings-backed)

**Bootstrap flow (conceptual):**
1. Kernel becomes ready
2. Feature flags manager initializes with `supabaseClient` and `userId`
3. Consolidated fetch (`get_feature_flags`) returns server-controlled state
4. Client caches state (offline) and subscribes to Realtime changes
5. UI reads from in-memory maps (no repeated network calls)

**Update flow (conceptual):**
- Realtime `postgres_changes` updates refresh in-memory state and re-notify subscribers.

## Precedence and Overrides (How Values “Win”)

When multiple sources can define the same flag/setting, Tier 3 relies on a simple precedence model:

1. **Local defaults** (appsettings) are the baseline.
2. **Server state** overlays that baseline (the “authoritative” runtime state when online).
3. **Overrides** take top priority.

Overrides generally exist for two reasons:

- **Server-side per-user overrides**: force-enable/disable behavior for a specific user for support, testing, or staged access.
   - Deep dive: `057 - User Specific Feature Flag Overrides/`

- **Local overrides**: developer/admin testing without requiring a server write.
   - Deep dive: typically described alongside the local flags system and Tier 3 manager behavior.

If you need the exact merge rules and payload shape, use the issue docs and the runtime manager (`lib/feature-flags/server-sync.ts`) as the source of truth.

## Entitlements Overview

Entitlements are the “premium capability” layer.

How Tier 3 aims to handle them:

- **Access-first correctness**: if an entitlement is expired or cannot be validated safely, access should be denied (fail-secure) rather than silently granted.
- **Offline continuity with guardrails**: entitlements can be cached for offline use, but expiry/time-boxing should still be respected.
- **UI should read a single source**: screens/features should check entitlements through the centralized runtime state, not by re-querying the network ad-hoc.

For deeper discussion and cleanup foundations:

- Entitlements cleanup foundation: `228 - Entitlements Cleanup/`
- Event-driven system context: `223 - Event-Driven Feature Flags Architecture/`

## Cohorts / Rollouts / Conditions

Tier 3 supports progressively more expressive control:

- **Conditions**: gate flags by runtime context (platform/environment/role, and advanced logic).
- **Cohorts**: gate flags to membership sets (allow-lists / deterministic bucketing patterns).
- **Rollouts / A-B variants**: percent-based activation for safe gradual rollout and controlled experimentation.

## Where the Details Live (Issue Docs)

This Tier 3 folder is the canonical deep-dive reference. Key entry points:

- Sync foundations: `054 - Sync System Features/`
- User-specific overrides: `057 - User Specific Feature Flag Overrides/`
- Rollouts / A-B testing: `058 - Support A-B Testing and Percentage-based Feature Rollouts/`
- Remote config: `059 - Remote Config/`
- Config diff tooling: `192 - Config Diff Tool/`
- Platform-specific config: `194 - Platform Specific Config/`
- Runtime config hot reload (dev): `195 - Runtime Config Hot Reload/`
- Cohorts: `196 - Feature Flags Cohorts/`
- Config versioning: `197 - Config Versioning/`
- Conditions: `198 - Feature Flags Conditions/`
- Event-driven architecture (Edge + client): `223 - Event-Driven Feature Flags Architecture/`
- Entitlements cleanup foundation: `228 - Entitlements Cleanup/`

## Known Audit Notes (Pointers)

During the audit, some cross-cutting “drift” items were documented outside this Tier 3 issue folder:

- See `docs/suggestions/` for critical gaps and refactor targets.
- Example: `docs/suggestions/CRITICAL - Tier 3 Cohort Assignments Not Applied.md` (if cohort assignment payloads are returned but not consumed by the client).

## How to Use This Summary

- If you’re implementing behavior: start with the relevant issue folder above.
- If you’re debugging runtime state: start with `223 - Event-Driven Feature Flags Architecture/` and `lib/feature-flags/server-sync.ts`.
- If you’re changing configuration schema: start with `197 - Config Versioning/` and `lib/config/`.
