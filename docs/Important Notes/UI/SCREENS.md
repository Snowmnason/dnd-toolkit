# Screens index

This index lists app screens (excluding `app/main/*` for now), with a short purpose note and optional components. Fill in components as we solidify each screen.

Legend

- Screen: file path under `app/`
- Purpose: 1–2 line intent
- Components: major UI pieces used (leave blank if unsure)

---

## Root

- Screen: `app/index.tsx`
  - Purpose: Entry redirect or landing shell
  - Components:

- Screen: `app/settings.tsx`
  - Purpose: App settings page
  - Components:

- Screen: `app/StyleDesktop.tsx`
  - Purpose: Desktop style showcase (design system demo)
  - Components:

- Screen: `app/StyleMobile.tsx`
  - Purpose: Mobile style showcase (design system demo)
  - Components:

---

## Auth flow (`app/login/*`)

- Screen: `app/login/sign-in.tsx`
  - Purpose: User sign-in
  - Components:

- Screen: `app/login/sign-up.tsx`
  - Purpose: Account registration
  - Components:

- Screen: `app/login/welcome.tsx`
  - Purpose: Post-auth welcome/next steps
  - Components:

- Screen: `app/login/forgot-password.tsx`
  - Purpose: Start password reset (request code)
  - Components:

- Screen: `app/login/reset-password.tsx`
  - Purpose: Complete password reset with code
  - Components:

- Screen: `app/login/confirm-signin.tsx`
  - Purpose: Confirm sign-in (MFA/code)
  - Components:

- Screen: `app/login/email-confirmation.tsx`
  - Purpose: Verify email
  - Components:

- Screen: `app/login/complete-profile.tsx`
  - Purpose: Complete user profile after auth
  - Components:

- Layout: `app/login/_layout.tsx`
  - Purpose: Auth stack layout and common wrappers
  - Components:

---

## Selection flow (`app/select/*`)

- Screen: `app/select/world-selection.tsx`
  - Purpose: List and choose a world
  - Components:

- Screen: `app/select/create-world.tsx`
  - Purpose: Create a new world
  - Components:

- Layout: `app/select/_layout.tsx`
  - Purpose: Selection stack layout and wrappers
  - Components:

---

## Main app shell

- Layout: `app/_layout.tsx`
  - Purpose: Root providers and router layout
  - Components:

- Screen: `app/main/_layout.tsx`
  - Purpose: Main app area layout (excluded from detailed mapping for now)
  - Components:

- Screen: `app/main/main-landing.tsx`
  - Purpose: Landing/home inside main app (excluded for now)
  - Components:

Sub-areas under `app/main` (mapping deferred):

- characters-npcs
- combat-events
- items-treasure
- story-notes
- world-exploration

---

## Notes

- Leave components blank if unsure. As we document each screen, list primary components (e.g., TopBar, AppView, TextInputs, ButtonGroup, Dropdown, Tabs, Snackbar/AppToast if used).
- Keep this synced with route changes; add or remove entries as files change.
