# Navigation — Test Guide (Web)

## Overview

- Purpose: Web-only navigation tests for deep links, TopBar/back behavior, and query-param propagation.
- Scope: `lib/navigation/navigation-config.ts`, `app/_layout.tsx`, `hooks/use-app-navigation.tsx`.

## Environments

- Web (desktop browsers)

## Prerequisites

- Browser with DevTools, sample deep links including `worldId` params

## Test Data

- Deep links: `/main?worldId=<id>`, `/select/world-selection?from=test`

## Test Cases

### Test Case — Address-bar deep link parameter propagation

- Goal: Query params and path segments from the address bar are available to route contexts.
- Steps:
  1. Open `https://dnd-tool.thesnowpost.com/main?worldId=<world-allowed>&userRole=<role>` in the browser.
  2. Inspect app context via debug UI or console to confirm `worldId` is present.
- Expected result:
  - TopBar and route components receive `worldId` and display expected content.
- Pass / Fail: [ ] Pass [ ] Fail

### Test Case — Back behavior after auth redirect

- Goal: Browser history behaves sensibly after a redirect caused by `useAuthGuard`.
- Steps:
  1. Navigate to a protected route unauthenticated via address bar.
  2. After redirect to login, authenticate and then check back button behavior.
- Expected result:
  - Browser back navigation does not return to a broken protected route; history is consistent.
- Pass / Fail: [ ] Pass [ ] Fail

## Scripts

- Not required; focus on manual browser verification and optionally automated E2E tests.

## Suggestions (web-specific)

- Record deep-link open events with full parameter dumps for QA tracing and reproducibility.

## Related Files

- `lib/navigation/navigation-config.ts`
- `app/_layout.tsx`
