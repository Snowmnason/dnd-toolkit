## Major Fixes

This milestone is focused on **hardening and validating the existing architecture**, not introducing new features.

The goal is to ensure the app is **safe to build on** before advancing to larger capabilities. Work in this milestone prioritizes correctness, enforcement, and predictability across a multiuser system.

### Scope
- Fix critical bugs and unstable behavior
- Enforce existing architectural guarantees and invariants
- Audit and standardize lifecycle behavior (auth, world switching, subscriptions)
- Clarify and document system behavior, limitations, and assumptions
- Improve visual consistency and UX polish only where it supports stability

### Non-Goals
- No new user-facing features
- No expansion of realtime or offline capabilities
- No major performance optimizations beyond bug fixes

This milestone exists to **prove the architecture is sound**, so future features can be added without rewrites, dead code, or breaking assumptions.
