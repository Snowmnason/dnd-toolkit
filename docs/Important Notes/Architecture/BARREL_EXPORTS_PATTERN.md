# Architectural Pattern: Module Barrel Exports

## Decision

**All lib/* modules should have their own `index.ts` barrel export**, even for small/simple modules.

## Rationale

1. **Modularity** – Each module controls its public API
2. **Security** – Can hide implementation details (private vs public)
3. **Consistency** – Uniform pattern across all modules
4. **Maintainability** – Central place to control what's exported
5. **Scalability** – Easy to split single-file modules later without breaking consumers

## Pattern

### Module Structure

```
lib/module-name/
  ├── index.ts                 // Barrel: re-exports public API
  ├── implementation.ts        // Private implementation
  └── README.md               // Documentation
```

### Barrel Export Example

```ts
// lib/module-name/index.ts
/**
 * Module Description
 * Provides: X, Y, Z
 */

export { PublicFunc, PublicType } from './implementation';
export type { PublicInterface } from './implementation';

// Hide private implementation details
// (no export for PrivateHelper, internalConstant, etc.)
```

### Consumer Usage

```ts
// Always import from module name (not specific files)
import { PublicFunc } from '@/lib/module-name';

// ❌ Don't do this:
import { PublicFunc } from '@/lib/module-name/implementation';
```

## Applied Modules

Modules with barrel exports:
- ✅ lib/analytics
- ✅ lib/api
- ✅ lib/auth
- ✅ lib/cache
- ✅ lib/config
- ✅ lib/database
- ✅ lib/kernel
- ✅ lib/navigation
- ✅ lib/network
- ✅ lib/premium
- ✅ lib/routing
- ✅ lib/schemas
- ✅ lib/storage

## Future Applications

When creating new lib/* modules, follow this pattern:

1. Create module directory: `lib/new-module/`
2. Create `index.ts` barrel export
3. Put implementation in separate files
4. Export only public API from `index.ts`
5. Update main `lib/index.ts` to export module barrel

## Benefits Realized

- **Clear API boundary** – README + index.ts document what consumers should use
- **Refactoring safety** – Can reorganize internals without breaking consumers
- **Type safety** – All exports are explicit (easier to tree-shake, type-check)
- **Discovery** – Developers know to look at index.ts for public API

## Notes

- This pattern is now the standard for all dnd-toolkit lib modules
- Revisit if performance becomes concern (unnecessary re-exports)
- Consider documenting in CONTRIBUTING.md
