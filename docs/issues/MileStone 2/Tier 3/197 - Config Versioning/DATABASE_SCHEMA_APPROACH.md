# Database Schema Migration Approach

## Overview

The config versioning system uses **database schema separation** rather than versioning within a single schema. This approach creates isolated schemas for different feature areas, allowing independent evolution while maintaining data integrity.

## Why Schema Separation?

### Benefits of This Approach

**1. Clean Separation of Concerns**
- Each schema contains related tables and functions
- No cross-contamination between feature areas
- Clear ownership and responsibility boundaries

**2. Independent Evolution**
- Features can evolve at their own pace
- Breaking changes in one schema don't affect others
- Easier to roll back individual features

**3. Security & Access Control**
- Schema-level permissions can be managed independently
- Different RLS policies per schema
- Granular access control for different user types

**4. Performance & Maintenance**
- Smaller, focused schemas are easier to optimize
- Schema-specific indexes and constraints
- Simplified backup/restore operations

**5. Development Velocity**
- Teams can work on different schemas simultaneously
- Reduced merge conflicts and integration issues
- Easier testing and deployment

## Current Schema Structure

```
Database
├── public (core user/auth data)
├── feature_flags (feature flag system)
├── audit (audit logging)
└── [future schemas]
```

### Schema Responsibilities

**`public` Schema**
- User authentication and profiles
- Core application data (worlds, sessions)
- Shared tables used across features

**`feature_flags` Schema**
- Feature flag definitions and states
- User entitlements and overrides
- A/B testing rollouts
- Remote configuration

**`audit` Schema**
- Security event logging
- Feature usage tracking
- Administrative action history

## Migration Strategy

### Schema Creation Pattern

```sql
-- 1. Create schema
CREATE SCHEMA IF NOT EXISTS feature_flags;

-- 2. Grant permissions
GRANT USAGE ON SCHEMA feature_flags TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA feature_flags TO anon, authenticated, service_role;

-- 3. Set default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA feature_flags
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
```

### Cross-Schema References

When schemas need to reference each other:

```sql
-- Reference public.users from feature_flags schema
CREATE TABLE feature_flags.user_entitlements (
  user_id UUID REFERENCES public.users(id),
  -- ... other fields
);
```

## Things to Look Out For

### 1. Schema Exposure in Supabase Dashboard

**Critical**: After creating a new schema, you MUST add it to:
- Supabase Dashboard → Settings → API → **Exposed Schemas**

If you forget this step:
- ❌ API calls will fail with "schema not found"
- ❌ RLS policies won't work
- ❌ Functions can't access tables

**Verification**: Check that new schemas appear in the API documentation.

### 2. RLS Policy Scope

RLS policies are schema-specific. A policy in `public` won't affect tables in `feature_flags`.

```sql
-- This only affects public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- This only affects feature_flags.user_entitlements
ALTER TABLE feature_flags.user_entitlements ENABLE ROW LEVEL SECURITY;
```

### 3. Function Search Path

Database functions need explicit schema qualification:

```sql
-- ❌ Ambiguous - which schema?
SELECT get_user_flags(user_id);

-- ✅ Explicit schema reference
SELECT feature_flags.get_user_flags(user_id);
```

### 4. Migration Dependencies

Schemas have dependencies. Migration order matters:

```
001_public_schema.sql     ← Run first (creates users)
002_worlds_schema.sql     ← Depends on public.users
003_feature_flags_schema.sql ← Can run anytime after 001
004_audit_schema.sql      ← Can run anytime after 001
```

### 5. Permission Inheritance

New tables automatically inherit schema permissions, but you may need explicit grants for special cases.

### 6. Backup & Restore Considerations

- Schema-specific backups are possible
- Cross-schema foreign keys complicate restores
- Test restore procedures for each schema

### 7. Development Environment Setup

Local development must replicate the schema structure:

```bash
# Apply migrations in order
supabase db reset
supabase db push
```

### 8. Testing Strategy

- Test each schema independently
- Test cross-schema interactions
- Verify RLS policies work across schemas
- Test with different user roles

## Best Practices

### Schema Naming
- Use lowercase with underscores: `feature_flags`, not `FeatureFlags`
- Keep names descriptive but concise
- Avoid reserved SQL keywords

### Table Organization
- Group related tables within schemas
- Use consistent naming patterns
- Document table relationships

### Migration Files
- Number sequentially: `001_`, `002_`, etc.
- Include clear headers with dependencies
- Add comments explaining complex operations

### Documentation
- Document schema responsibilities
- Keep migration notes up to date
- Update API documentation for new schemas

## Troubleshooting

### Common Issues

**"Schema doesn't exist" errors**
- Check Supabase Dashboard → API → Exposed Schemas
- Verify migration ran successfully
- Check database connection permissions

**RLS policy not working**
- Verify policy is in the correct schema
- Check user authentication status
- Test with service role key

**Cross-schema references failing**
- Ensure referenced schema exists
- Check foreign key constraints
- Verify permissions on referenced tables

**Migration order problems**
- Check migration file numbering
- Verify prerequisites are met
- Test migrations individually</content>
<parameter name="filePath">p:\CodingProjects\dnd-toolkit\docs\issues\MileStone 2\Tier 3\197 - Config Versioning\DATABASE_SCHEMA_APPROACH.md