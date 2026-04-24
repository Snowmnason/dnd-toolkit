**This is a possible naming convention, just a consideration, not to be done yet**

## Naming Conventions

**Screens/Routes (app/ and Screens/)**
- Lowercase, no separators (no hyphens, underscores, or camelCase)
- Multi-word routes written as one word
- Examples: `login/`, `main/`, `settings/`, `worldsettings/`, `charselection/`, `invites/`

**Hooks (hooks/)**
- Prefix: `use-`
- kebab-case (lowercase with hyphens)
- Examples: `use-app-kernel.tsx`, `use-world-query.tsx`, `use-guarded-navigation.ts`

**Lib (lib/)**
- camelCase (lowercase start)
- Main entrypoint per domain: `[domain]Manager.ts`
- Examples: `authManager.ts`, `navigationManager.ts`, `worldManager.ts`

**Lib → Middleware Bridge (lib/middleware/services/)**
- kebab-case with `-service` suffix
- Examples: `nav-service.ts`, `auth-service.ts`, `world-service.ts`

**System (system/)**
- Directory: `system/ModuleName/` (PascalCase)
- Files: lowercase with underscores
- Main orchestrator: `app_[module].ts`
- Examples:
  - `system/Navigation/app_navigation.ts`
  - `system/API/app_api.ts`
  - `system/Storage/cache_manager.ts`
  - `system/Network/connection_state.ts`

**Screens Components (Screens/, components/)**
- PascalCase (CamelCase starting with uppercase)
- Examples: `WorldSettings.tsx`, `CharacterSelect.tsx`, `AuthForm.tsx`

**UI Components (components/ui/)**
- PascalCase
- Exported via barrel: index.ts
- Examples: `Button.tsx`, `Modal.tsx`, `TextInput.tsx`

**Shared/Root-Level (maps/, type-definitions/, validation/, pure-algo-immutables/)**
- Directories: kebab-case (lowercase with hyphens)
- Files inside: lowercase with underscores or camelCase depending on export type
- Examples:
  - `maps/storage_keys.ts`
  - `type-definitions/navigation_decision.ts`
  - `validation/auth_schemas.ts`
  - `pure-algo-immutables/rollout_logic.ts`

---