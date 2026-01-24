# Important Notes - Documentation Index

High-level reference documentation for D&D Toolkit. Start here for quick answers about components, database, architecture, integrations, and development workflows.

---

## 📦 Folders

### [UI/](UI/)

UI components catalog and screen index.

- **COMPONENTS.md** - All UI components with variants, props, dependencies
- **SCREENS.md** - App screen map with purposes and component usage

### [Database/](Database/)

Database schema reference and indexes.

- **SCHEMA.md** - Core tables, columns, constraints, RLS policies
- **INDEXES.md** - Performance index reference

### [Architecture/](Architecture/)

High-level architectural decisions.

- **CACHING_POLICY.md** - Data caching strategy (memory, disk, encrypted storage)

### [Integration/](Integration/)

Third-party integrations and system features.

- **NOTIFICATIONS.md** - Notification system (Notification, SnackBar, AppToast)
- **DESKTOP_APP.md** - Electron app build configuration and CSP security

### [Dev/](Dev/)

Developer workflows and release management.

- **SCRIPTS.md** - All npm scripts (web, desktop, mobile)
- **RELEASES.md** - Release management and versioning guide

### [architectural-decisions/](architectural-decisions/)

Archive of architectural decision records (ADRs).

---

## 🚀 Quick Start

**I want to know about...**

- **UI Components** → [UI/COMPONENTS.md](UI/COMPONENTS.md)
- **App Screens** → [UI/SCREENS.md](UI/SCREENS.md)
- **Database Tables** → [Database/SCHEMA.md](Database/SCHEMA.md)
- **Database Indexes** → [Database/INDEXES.md](Database/INDEXES.md)
- **Caching Strategy** → [Architecture/CACHING_POLICY.md](Architecture/CACHING_POLICY.md)
- **Notifications** → [Integration/NOTIFICATIONS.md](Integration/NOTIFICATIONS.md)
- **Desktop App Build** → [Integration/DESKTOP_APP.md](Integration/DESKTOP_APP.md)
- **npm Scripts** → [Dev/SCRIPTS.md](Dev/SCRIPTS.md)
- **Releases** → [Dev/RELEASES.md](Dev/RELEASES.md)

---

## 📋 Organization Notes

- Each folder has a **README.md** with quick links and overview
- Files are organized by topic (UI, Database, Architecture, Integration, Dev)
- No code snippets — high-level reference only
- All relative links work from any nested file

---

## See Also

- For detailed implementation, see `docs/issues/` (Milestone 1 features)
- For component examples and best practices, see `lib/README.md`
- For testing guides, see `docs/A Testing Guide/`
