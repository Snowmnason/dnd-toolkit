### Summary
Create a restricted **Admin Panel** for trusted non-developer users (e.g., QA testers) that allows controlled access to feature testing without exposing full developer overrides.

### Scope
- Admin panel is **not** the same as developer settings
- Intended for QA, testers, or internal reviewers
- Must respect production safety rules

### Acceptance Criteria
- [ ] Add a **developer settings menu / toggle**, accessible only via a deliberate action:
  - Keyboard shortcut
  - Command-line flag
  - Hidden menu / gesture
- [ ] Admin panel access is role-based (e.g., QA/Admin role)
- [ ] Admins can:
  - [ ] Toggle approved feature flags
  - [ ] Simulate premium states or test flows (where safe)
- [ ] Admin panel does **not** allow:
  - Arbitrary dev overrides
  - Bypassing core security or payment validation
- [ ] Admin features are auditable and clearly separated from dev-only tools

### Notes
- Dev overrides are **never planned** for production use
- Admin tooling should sit on top of the feature flag system, not bypass it


# Implemenation


4. Create an admin-panel that has a switch that toggles for all feature flags and feature flag filters -in `appsettings.json`

## NOTE
Should be kept really simple, no need for fancy beauty or surfaces, you can leave it super simple, with a view and a bunch of switches with a name of the flag the user can turn on