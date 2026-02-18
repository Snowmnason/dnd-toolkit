# Entitlements

Hooks for handling entitlement expiration and user notification. Used to prompt users when their premium or feature access has expired.

## When to Use This Module

**Use this module if you need to:**
- Show a modal or UI when a user's entitlement expires
- Trigger flows to renew or upgrade entitlements

**Do NOT use this module for:**
- Checking entitlement status (use `lib/premium` or `hooks/feature`)
- Managing subscription state directly

## Architecture & Data Flow

```
Entitlement expires
        ↓
useEntitlementExpiredModal
        ↓
Show modal / prompt user action
```

**Key Principles:**
- **User feedback**: Prompt users immediately when access changes.
- **Separation**: Modal logic is decoupled from entitlement checks.

## API Reference

### `useEntitlementExpiredModal()`
Show and manage the entitlement expired modal.

## Dependencies

### External Packages
- None

### Internal Dependencies
- **`lib/premium`** – entitlement and subscription logic

## Error Handling & Edge Cases

### Modal Dismissal
Ensure users can always dismiss or act on the modal; avoid dead-ends.

## Performance Notes

Modal is only shown on entitlement change; negligible runtime cost.

## Related Modules
- **`lib/premium`** – entitlement and subscription logic

## File Breakdown
| File | Purpose |
| ---- | ------- |
| `useEntitlementExpiredModal.ts` | Show and manage entitlement expired modal |
