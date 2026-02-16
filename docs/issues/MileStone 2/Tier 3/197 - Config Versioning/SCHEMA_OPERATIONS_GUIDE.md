# Schema Migration Operations Guide

## Operational Considerations for Schema-Based Config Versioning

This guide covers the operational aspects of maintaining a multi-schema database architecture for configuration and feature management.

## Schema Lifecycle Management

### Creating New Schemas

**1. Migration File Structure**
```sql
-- File: supabase/migrations/005_new_feature_schema.sql
-- ============================================================
-- 005: NEW_FEATURE SCHEMA
-- Tables: [list tables created]
-- ============================================================
-- EXECUTION ORDER: Run AFTER [prerequisites]
-- PREREQUISITES: [what must exist first]
-- AFTER THIS: Run [next migration if any]
-- ============================================================

BEGIN;

-- Create schema
CREATE SCHEMA IF NOT EXISTS new_feature;

-- Permissions (standard pattern)
GRANT USAGE ON SCHEMA new_feature TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA new_feature TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA new_feature TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA new_feature TO anon, authenticated, service_role;

-- Default privileges
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA new_feature
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA new_feature
  GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA new_feature
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Tables, functions, policies...
-- [schema content]

COMMIT;
```

**2. Post-Migration Checklist**
- [ ] Add schema to Supabase Dashboard → API → Exposed Schemas
- [ ] Update API documentation
- [ ] Test RLS policies
- [ ] Verify cross-schema references work
- [ ] Update development environment
- [ ] Add to backup procedures

### Schema Modification Patterns

**Adding Tables to Existing Schema**
```sql
-- Safe: Adding to existing schema
CREATE TABLE feature_flags.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... fields
);

-- Grant permissions (inherits from schema defaults)
-- No additional grants needed if defaults are set
```

**Modifying Existing Tables**
```sql
-- Safe: Adding columns
ALTER TABLE feature_flags.existing_table
ADD COLUMN new_field TEXT;

-- Risky: Dropping columns (data loss!)
-- ALTER TABLE feature_flags.existing_table
-- DROP COLUMN old_field;
```

## Critical Watch-Outs

### 1. Supabase Dashboard Configuration

**EXPOSED SCHEMAS IS CRITICAL**
- Location: Supabase Dashboard → Settings → API → Exposed Schemas
- Required for: API access, RLS policies, Edge Functions
- Symptoms of missing: "relation does not exist" errors
- Fix: Add schema name to the comma-separated list

**Verification Steps:**
1. Go to Supabase Dashboard → Settings → API
2. Check "Exposed Schemas" field
3. Ensure all schemas are listed: `public,feature_flags,audit`
4. Save and wait for API refresh (may take minutes)

### 2. RLS Policy Isolation

**Policies Don't Cross Schemas**
```sql
-- This policy only affects feature_flags tables
CREATE POLICY "user_can_read_own_flags" ON feature_flags.user_entitlements
FOR SELECT USING (auth.uid() = user_id);

-- Separate policy needed for public tables
CREATE POLICY "user_can_read_profile" ON public.users
FOR SELECT USING (auth.uid() = id);
```

**Testing RLS:**
- Test with authenticated users
- Test with anonymous users
- Test cross-schema queries
- Verify service role bypasses RLS

### 3. Function Schema Qualification

**Always Qualify Function Calls**
```sql
-- ❌ Ambiguous - search_path dependent
SELECT get_user_entitlements(user_id);

-- ✅ Explicit - always works
SELECT feature_flags.get_user_entitlements(user_id);
```

**Function Creation:**
```sql
-- Create in specific schema
CREATE OR REPLACE FUNCTION feature_flags.get_user_entitlements(user_uuid UUID)
RETURNS TABLE(...) AS $$
-- function body
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Migration Ordering Dependencies

**Dependency Chain:**
```
001_public_schema.sql
├── Creates: public.users, public.sessions
├── Required by: All other schemas

002_worlds_schema.sql
├── Depends on: public.users
├── Creates: public.worlds, public.world_access

003_feature_flags_schema.sql
├── Depends on: public.users
├── Creates: feature_flags.*, functions

004_audit_schema.sql
├── Depends on: public.users
└── Creates: audit.*
```

**Breaking Dependencies:**
- Never drop tables other schemas depend on
- Test migrations in dependency order
- Document prerequisites clearly

### 5. Permission Inheritance

**Schema Defaults Handle Most Cases:**
```sql
-- This gives access to all current and future tables
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA feature_flags
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
```

**Special Cases Needing Explicit Grants:**
- Custom roles beyond anon/authenticated/service_role
- Special permissions (TRUNCATE, etc.)
- Cross-schema references

### 6. Development Environment Sync

**Local Development Setup:**
```bash
# Reset and apply all migrations
supabase db reset

# Or push changes
supabase db push

# Verify schemas exist
supabase db inspect
```

**Schema Sync Issues:**
- Local migrations may be ahead/behind production
- Schema exposure settings don't sync automatically
- Test locally before deploying

### 7. Backup and Recovery

**Schema-Specific Operations:**
```sql
-- Backup specific schema
pg_dump -h host -U user -n feature_flags dbname > feature_flags.sql

-- Restore specific schema
psql -h host -U user -d dbname -f feature_flags.sql
```

**Cross-Schema Dependencies:**
- Foreign keys complicate restores
- Restore in dependency order
- Test restore procedures regularly

### 8. Performance Considerations

**Schema-Level Optimization:**
- Indexes are schema-specific
- Statistics are schema-specific
- Query planning considers schema isolation

**Monitoring:**
- Watch for cross-schema query performance
- Monitor schema-specific metrics
- Plan for schema growth

## Emergency Procedures

### Schema Access Issues

**If API calls fail:**
1. Check Supabase Dashboard → API → Exposed Schemas
2. Verify schema exists: `SELECT schema_name FROM information_schema.schemata;`
3. Check permissions: `\dn+ schema_name`
4. Test with service role key

### Rollback Strategy

**For Schema Changes:**
1. Have backup migration ready
2. Test rollback in staging
3. Document rollback steps
4. Have data recovery plan

**For Failed Deployments:**
1. Revert migration file
2. Restore from backup if needed
3. Update exposed schemas if changed
4. Clear application caches

## Monitoring and Alerts

### Key Metrics to Watch

- Schema size growth trends
- Cross-schema query performance
- RLS policy evaluation time
- Migration execution time
- API error rates by schema

### Health Checks

**Daily Verification:**
- All schemas accessible via API
- RLS policies working
- Cross-schema references intact
- Migration scripts runnable

**Automated Tests:**
- Schema existence checks
- Permission verification
- Basic CRUD operations per schema
- RLS policy validation