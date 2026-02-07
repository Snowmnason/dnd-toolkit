# 🔒 Row Level Security (RLS) Policies — DnD Toolkit

This document defines all Row Level Security (RLS) policies for the D&D Toolkit database.  
Each policy restricts database access based on the authenticated user.

**Format**: `[Policy Name] | [Command] | [Role(s)] | [USING Clause] | [WITH CHECK Clause]`

---

## PUBLIC.USERS

| Policy Name               | Command | Role(s)               | USING                             | WITH CHECK                        |
| ------------------------- | ------- | --------------------- | --------------------------------- | --------------------------------- |
| `users_select_own`        | SELECT  | authenticated         | `auth.uid() = auth_id`            | —                                 |
| `users_insert_own`        | INSERT  | authenticated         | —                                 | `auth.uid() = auth_id`            |
| `users_update_own`        | UPDATE  | authenticated         | `auth.uid() = auth_id`            | `auth.uid() = auth_id`            |
| `users_delete_own`        | DELETE  | authenticated         | `auth.uid() = auth_id`            | —                                 |
| `users_admin_full_access` | ALL     | authenticated (admin) | `(auth.jwt()->>'role') = 'admin'` | `(auth.jwt()->>'role') = 'admin'` |

**Description**: Users can only read/write their own profile. Admins have full access.

---

## PUBLIC.WORLDS

| Policy Name                  | Command | Role(s)       | USING                                                                                                                                   | WITH CHECK                                                      |
| ---------------------------- | ------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `worlds_owner_full`          | ALL     | authenticated | `owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())`                                                                         | `owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())` |
| `worlds_collaborator_select` | SELECT  | authenticated | `EXISTS (SELECT 1 FROM world_access WHERE world_id = worlds.world_id AND user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))` | —                                                               |
| `worlds_collaborator_update` | UPDATE  | authenticated | `EXISTS (SELECT 1 FROM world_access WHERE world_id = worlds.world_id AND user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))` | `owner_id = worlds.owner_id`                                    |

**Description**: World owners have full control. Collaborators can read and (if permissions allow) update, but cannot change ownership.

---

## PUBLIC.WORLD_ACCESS

| Policy Name                           | Command | Role(s)       | USING                                                                                                                  | WITH CHECK                                                     |
| ------------------------------------- | ------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `world_owner_any_ops_on_world_access` | ALL     | authenticated | `owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()) JOIN worlds ON world_access.world_id = worlds.world_id` | Same as USING                                                  |
| `member_self_manage_access`           | ALL     | authenticated | `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())`                                                         | `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())` |

**Description**: World owners can manage all access controls for their worlds. Members can manage their own access records.

---

## PUBLIC.INVITE_LINKS

| Policy Name                 | Command | Role(s)               | USING                                                                                                                                                                                     | WITH CHECK                                                                                                                                                                             |
| --------------------------- | ------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invite_links_public_read`  | SELECT  | public, authenticated | `expires_at > now()`                                                                                                                                                                      | —                                                                                                                                                                                      |
| `invite_links_owner_select` | SELECT  | authenticated         | `created_by IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid() JOIN worlds ON invite_links.world_id = worlds.world_id)` | —                                                                                                                                                                                      |
| `invite_links_insert_owner` | INSERT  | authenticated         | —                                                                                                                                                                                         | `(created_by IN (SELECT id FROM users WHERE auth_id = auth.uid())) OR (world_id IN (SELECT world_id FROM worlds WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid())))` |
| `invite_links_delete_owner` | DELETE  | authenticated         | `created_by IN (SELECT id FROM users WHERE auth_id = auth.uid()) OR world_id IN (SELECT world_id FROM worlds WHERE owner_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))`        | —                                                                                                                                                                                      |

**Description**: Public can read active (non-expired) invite links. Owners can create and delete their own links.

---

## PUBLIC.FEATURE_FLAGS

| Policy Name                 | Command                | Role(s)               | USING                             | WITH CHECK                        |
| --------------------------- | ---------------------- | --------------------- | --------------------------------- | --------------------------------- |
| `feature_flags_public_read` | SELECT                 | public, authenticated | `true`                            | —                                 |
| `feature_flags_admin_write` | INSERT, UPDATE, DELETE | authenticated (admin) | `(auth.jwt()->>'role') = 'admin'` | `(auth.jwt()->>'role') = 'admin'` |

**Description**: Feature flags are publicly readable (needed by Edge Function and client). Only admins can create/update/delete.

---

## PUBLIC.ENTITLEMENTS

| Policy Name                      | Command | Role(s)               | USING                                                          | WITH CHECK                        |
| -------------------------------- | ------- | --------------------- | -------------------------------------------------------------- | --------------------------------- |
| `entitlements_user_read_own`     | SELECT  | authenticated         | `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())` | —                                 |
| `entitlements_admin_full_access` | ALL     | authenticated (admin) | `(auth.jwt()->>'role') = 'admin'`                              | `(auth.jwt()->>'role') = 'admin'` |

**Description**: Users can see their own premium entitlements. Admins have full control for granting/revoking access.

---

## PUBLIC.FEATURE_FLAG_OVERRIDES

| Policy Name               | Command                | Role(s)               | USING                                                          | WITH CHECK                        |
| ------------------------- | ---------------------- | --------------------- | -------------------------------------------------------------- | --------------------------------- |
| `overrides_user_read_own` | SELECT                 | authenticated         | `user_id IN (SELECT id FROM users WHERE auth_id = auth.uid())` | —                                 |
| `overrides_admin_write`   | INSERT, UPDATE, DELETE | authenticated (admin) | `(auth.jwt()->>'role') = 'admin'`                              | `(auth.jwt()->>'role') = 'admin'` |

**Description**: Users can view their own overrides (for transparency). Admins manage all overrides for QA/testing.

---

## PUBLIC.FEATURE_FLAG_ROLLOUTS

| Policy Name                   | Command                | Role(s)               | USING                             | WITH CHECK                        |
| ----------------------------- | ---------------------- | --------------------- | --------------------------------- | --------------------------------- |
| `rollouts_authenticated_read` | SELECT                 | authenticated         | `true`                            | —                                 |
| `rollouts_service_role_read`  | SELECT                 | service_role          | `true`                            | —                                 |
| `rollouts_admin_write`        | INSERT, UPDATE, DELETE | authenticated (admin) | `(auth.jwt()->>'role') = 'admin'` | `(auth.jwt()->>'role') = 'admin'` |

**Description**: Rollout configs are readable by authenticated users and service role (Edge Function). Only admins can create/update/delete configurations.

---

## Implementation Notes

### Authentication Flow

1. **Supabase Auth**: User logs in via `auth.users` table
2. **App Users**: Entry in `users` table with `auth_id` foreign key
3. **JWT Claims**: `auth.uid()` returns the authenticated user's ID
4. **Role Check**: `auth.jwt()->>'role'` extracts role claim from JWT

### Policy Evaluation

- **USING**: Determines which rows are **visible** (for SELECT, UPDATE, DELETE)
- **WITH CHECK**: Determines which rows can be **inserted/updated** (for INSERT, UPDATE)
- All conditions use AND logic; if multiple policies exist, any that return true allows the operation

### Admin Role

An admin is identified by `(auth.jwt()->>'role') = 'admin'` in the JWT claims.  
This must be set during user creation in Supabase Auth or via custom claims.

### Service Role

The `service_role` is used by Edge Functions to bypass RLS for internal operations.  
It has full database access and is protected by environment variables.

---

## Debugging RLS Issues

1. **User can't see data**: Check USING clause — may not match user's ID
2. **Insert/update fails**: Check WITH CHECK clause — may violate constraints
3. **Admin can't access**: Verify `(auth.jwt()->>'role') = 'admin'` is set in Supabase
4. **Enable RLS logging**: Run `SET log_statement = 'all'` in Supabase SQL Console

---

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- See [SCHEMA.md](SCHEMA.md) for full table and policy definitions
- See [INDEXES.md](INDEXES.md) for all database indexes

---

_Last Updated: Feb 7, 2026_
