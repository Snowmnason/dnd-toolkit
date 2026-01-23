# Auth Guard — Test Guide (Web)

## Overview

- Purpose: Web-only tests for `useAuthGuard` behavior: Supabase session handling, address-bar deep links, and cache-first world verification.
- Scope: `lib/auth/useAuthGuard.ts`, `lib/auth/auth-state.ts`, `lib/routing/route-config.ts`, `lib/database/supabase.ts`.

## Environments

- Web (desktop browsers)

## Prerequisites

- Browser with DevTools open
- Test accounts: confirmed, unconfirmed, and an account with no active session
- Test world IDs for allowed/denied cases

## Test Data

- `user_confirmed`, `user_unconfirmed`, `user_no_session`
- `world-allowed`, `world-denied`

## Test Cases

### Test Case — Unauthenticated redirect (web)

- Goal: Browser navigation to protected routes without auth redirects to `/` (or login).
- Steps:
  1. Open browser and navigate to `/main` or `/settings` directly via address bar.
  2. Ensure local storage/secure storage has `hasAccount=false` (clear storage or use a fresh profile).
  3. Observe navigation and console.
- Expected result:
  - Browser navigates to `/` (root) or login page. Console logs include `security` redirect message.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Deep-link with `worldId` param

- Goal: Address-bar deep links with `worldId` propagate correctly and trigger verification.
- Steps:
  1. Open `https://dnd-tool.thesnowpost.com/main?worldId=<world-allowed>&userRole=<role>` in browser.
  2. Observe page load, console messages, and final routing.
- Expected result:
  - Guard reads `worldId`, runs cache-first verification, and either allows page or redirects to `/select/world-selection`.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Supabase-not-configured fallback

- Goal: Confirm web behavior when `isSupabaseConfigured()` is false.
- Steps:
  1. Run web build/config where Supabase env is missing.
  2. Navigate to protected routes and observe routing.
- Expected result:
  - Guard uses local `hasAccount` flag; no Supabase calls are attempted. UI shows expected fallback routing.
- Pass / Fail: [ ] Pass [ ] Fail

## Scripts

- Not required; web tests use DevTools and browser automation if available.

## Risk / Known Issues

- Browser storage differences may affect `SecureStorage` behavior; test across Chrome/Firefox/Edge.

## Suggestions (web-specific)

- Add a small banner in dev web builds when Supabase is not configured to avoid QA confusion.

## Related Files

- `lib/auth/useAuthGuard.ts`
- `lib/auth/auth-state.ts`
- `lib/routing/route-config.ts`
