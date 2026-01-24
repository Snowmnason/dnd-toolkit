# QA Testing Guides

Welcome! This folder contains step-by-step testing guides for non-developers (QA testers, product managers, etc.). These guides help you verify that app features work correctly without needing to understand code or use developer tools.

## What's Inside

- **App/** – Tests for desktop (Electron) and mobile (iOS/Android) apps
- **Both/** – Tests that apply to both web and app versions
- **Web/** – Tests for the web version only (desktop browser)

## Quick Start for QA Testers

Each guide follows the same format:

1. **Read the Overview** – Understand what you're testing
2. **Gather Prerequisites** – Prepare test accounts, clear the app cache if needed, etc.
3. **Follow Test Cases** – Execute each test step-by-step
4. **Record Evidence** – Take screenshots showing results
5. **Mark Pass/Fail** – Indicate whether the behavior matched expectations

## Key Principles

### Non-Developer Friendly

- No code, no console commands required (unless explicitly noted)
- Instructions use simple, user-facing actions
- If a guide requires console access, the developer should provide a simpler alternative

### Platform-Specific Notes

- **App (Electron/Mobile)** – No browser console or address bar available; focus on UI behavior
- **Web** – Can use browser console for certain tests; includes DevTools guidance when useful
- **Both** – Tests that apply everywhere (sign-in, world creation, etc.)

### Evidence = Confidence

- Screenshots showing the final state are mandatory
- If something looks wrong, take a screenshot and write a brief note
- Include the test account email and any unusual steps you took

## Common Test Scenarios

### "Test the app works while offline"

- Disable Wi-Fi / Cellular (airplane mode is easiest)
- Try to navigate and interact with the app
- Screenshot the result (especially if a message appears)
- Re-enable network and continue other tests

### "Test user permissions"

- Use different test accounts (free vs. premium, different roles)
- Verify locked features show appropriate UI (lock icon, upgrade prompt, etc.)
- Screenshot the differences between account types

### "Test sign-in flow"

- Use email/password from the test account list
- Watch for confirmation screens, errors, or redirects
- End result: you should land on the main screen or a world selector

## Test Account Reference

Ask your developer for:

- A **free user account** (non-premium)
- A **premium user account** (with premium features active)
- A **world owner account** (creator of test worlds)
- Instructions for accessing **staging** vs. **production** environments

## Troubleshooting

**"The app crashed"** – Take a screenshot of any error message, restart the app, try the test again.

**"I got stuck on a loading screen"** – Wait 30 seconds, then try restarting the app. If it persists, report it to the developer.

**"The feature is missing from the UI"** – It might be controlled by a feature flag (developer-only toggle). Ask the developer if the feature is enabled for staging.

**"I'm not sure if this is a pass or fail"** – Take a screenshot and write down what you see. The developer can clarify later.

## How to Report Results

For each test guide:

1. Open the `.md` file in a text editor or email the developer
2. For each test case, mark `[ ]` as `[x]` (✓) for Pass or leave empty for Fail
3. Attach or link to screenshots showing the results
4. Add any notes about what went wrong (if a test failed)

Example:

```
### Test Case — App start with existing session
- Pass / Fail: [x] Pass
- Evidence:
  - Screenshot: [link/attachment]
  - Notes: Loaded main screen correctly with user@example.com
```

## Maintaining These Guides

Test guides are updated when:

- A new feature is added that testers need to validate
- An existing feature's behavior changes
- A new authentication method or permission level is introduced
- A bug fix affects user-visible behavior

If you notice a guide is out of date or confusing, tell the developer so it can be improved.

---

**Need help?** Ask your developer for clarification on any test case. These guides should be clear enough that you don't need code knowledge to complete them.
