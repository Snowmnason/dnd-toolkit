# Database Documentation

Reference for database schema, tables, indexes, triggers, and Edge Functions.

## Contents

- **[SCHEMA.md](SCHEMA.md)** - Core tables, columns, constraints, and RLS policies
- **[INDEXES.md](INDEXES.md)** - Index reference for performance and query optimization
- **[TRIGGERS.md](TRIGGERS.md)** - Database triggers for automation and audit logging
- **[EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)** - Supabase Edge Functions (serverless RPC endpoints)

## Quick Overview

### Core Tables

- **users** - App users linked to Supabase auth
- **worlds** - Campaign worlds owned by users
- **world_access** - User membership and roles in worlds
- **invite_links** - Shareable links for world invitations
- **feature_flags** - Global feature flag definitions
- **entitlements** - User feature entitlements with expiry
- **feature_flag_overrides** - Per-user feature flag overrides
- **entitlements_overrides** - Admin overrides for entitlements
- **feature_flag_rollouts** - A/B rollout configurations

### Key Concepts

- **Row Level Security (RLS)** - Fine-grained access control at the database level
- **Foreign Keys** - Relationships between tables (cascade on delete)
- **Indexes** - Performance optimization for common queries (see [INDEXES.md](INDEXES.md))
- **Triggers** - Automatic actions on data changes (see [TRIGGERS.md](TRIGGERS.md))
- **Audit Logging** - Immutable event trail for compliance (see [TRIGGERS.md](TRIGGERS.md#audit-schema-triggers))
- **Auth Integration** - Links to Supabase `auth.users` table
- **Edge Functions** - Serverless compute for business logic (see [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md))

## For Developers

**Start here:**

1. [SCHEMA.md](SCHEMA.md) — Understand the data model and RLS policies
2. [INDEXES.md](INDEXES.md) — Optimize queries with appropriate indexes
3. [TRIGGERS.md](TRIGGERS.md) — Learn about automated maintenance and audit trails
4. [EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md) — Call serverless endpoints from the app

**Common Tasks:**

- Adding a new table → Update SCHEMA.md, add indexes to INDEXES.md, add audit trigger to TRIGGERS.md
- Optimizing slow queries → Check INDEXES.md for existing indexes or add new ones
- Debugging data inconsistencies → Check TRIGGERS.md for automatic maintenance or query audit.events
- Server-side operations → Use Edge Functions (see EDGE_FUNCTIONS.md)
