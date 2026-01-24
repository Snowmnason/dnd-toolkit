# Database Schema (Public)

This document captures the core Postgres tables, indexes, and row level security (RLS) policies for the D&D Toolkit backend.

---

## Tables

### worlds

```sql
create table public.worlds (
  world_id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  name text not null default 'World',
  description text null default '',
  system text null default 'D&D 5e',
  created_at timestamp with time zone null default (now() AT TIME ZONE 'utc'),
  updated_at timestamp with time zone null default (now() AT TIME ZONE 'utc'),
  map_image_url text null,
  is_dm boolean not null default true,
  constraint worlds_pkey primary key (world_id),
  constraint worlds_owner_id_fkey1 foreign key (owner_id) references users (id) on update cascade on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_worlds_owner_id on public.worlds using btree (owner_id) tablespace pg_default;
```

### world_access

```sql
create table public.world_access (
  id uuid not null default gen_random_uuid(),
  world_id uuid not null,
  user_id uuid not null,
  user_role text not null default 'player',
  permissions jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint world_access_pkey primary key (id),
  constraint world_access_user_id_fkey foreign key (user_id) references users (id) on delete cascade,
  constraint world_access_world_id_fkey foreign key (world_id) references worlds (world_id) on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_world_access_world_id on public.world_access using btree (world_id) tablespace pg_default;
create index if not exists idx_world_access_user_id  on public.world_access using btree (user_id) tablespace pg_default;
create unique index if not exists idx_world_access_world_user on public.world_access using btree (world_id, user_id) tablespace pg_default;
create index if not exists idx_world_access_user_created on public.world_access using btree (user_id, created_at desc) tablespace pg_default;
```

### users

```sql
create table public.users (
  id uuid not null default gen_random_uuid(),
  auth_id uuid not null,
  username text not null default 'changeling',
  created_at timestamp with time zone not null default now(),
  isAdmin boolean not null default false,
  constraint users_pkey primary key (id),
  constraint users_auth_id_fkey foreign key (auth_id) references auth.users (id) on update cascade on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_users_auth_id on public.users using btree (auth_id) tablespace pg_default;
```

### invite_links

```sql
create table public.invite_links (
  id uuid not null default gen_random_uuid(),
  world_id uuid null,
  created_by uuid null,
  token uuid not null default gen_random_uuid(),
  expires_at timestamp with time zone not null default (now() + interval '24 hours'),
  created_at timestamp with time zone null default now(),
  constraint invite_links_pkey primary key (id),
  constraint invite_links_token_key unique (token),
  constraint invite_links_created_by_fkey foreign key (created_by) references users (id) on delete cascade,
  constraint invite_links_world_id_fkey foreign key (world_id) references worlds (world_id) on delete cascade
) tablespace pg_default;
```

Indexes:

```sql
create index if not exists idx_invite_links_expires_at on public.invite_links using btree (expires_at) tablespace pg_default;
```

---

## Row Level Security (RLS) Policies

Each policy shows: Name, Command, Roles, USING predicate, and optional WITH CHECK.

### users

```text
users_select_own        | SELECT | authenticated | USING: auth.uid() = auth_id
users_insert_own        | INSERT | authenticated | CHECK: auth.uid() = auth_id
users_update_own        | UPDATE | authenticated | USING: auth.uid() = auth_id | CHECK: auth.uid() = auth_id
users_delete_own        | DELETE | authenticated | USING: auth.uid() = auth_id
users_admin_full_access | ALL    | authenticated | USING: (auth.jwt()->>'role') = 'admin'
```

### world_access

```text
world_owner_any_ops_on_world_access | ALL | authenticated | USING/CHECK: get_world_owner_auth_id(world_id) = auth.uid()
member_self_manage_access          | ALL | authenticated | USING/CHECK: get_user_auth_id(user_id) = auth.uid()
```

### invite_links

```text
invite_links_public_read  | SELECT | public        | USING: true
invite_links_insert_owner | INSERT | authenticated | CHECK: (created_by matches auth.uid() OR owner/dm of world)
invite_links_owner_select | SELECT | authenticated | USING: requestor is world owner
```

### worlds

```text
worlds_owner_full          | ALL    | authenticated | USING/CHECK: world owner auth_id = auth.uid()
worlds_collaborator_update | UPDATE | authenticated | USING: user has world_access row | CHECK: owner_id remains unchanged
worlds_collaborator_select | SELECT | authenticated | USING: user has world_access row
```

---

## Helper Functions Referenced

These server-side functions (not shown here) must exist:

```text
get_world_owner_auth_id(world_id uuid) -> uuid
get_user_auth_id(user_id uuid) -> uuid
```

---

## Notes

- All UUIDs default via `gen_random_uuid()`.
- Timestamps normalized to UTC via `now() AT TIME ZONE 'utc'` where needed.
- Invite links expire after 24 hours by default.
- Access control relies on mapping app auth user (auth.users) to internal `users` table via `auth_id`.
- Policies favor explicit ownership & collaborator rows for flexibility.

---

## Potential Improvements

- Add partial index for active invite links: `where expires_at > now()`.
- Consider materialized view for world membership summary.
- Add audit triggers for critical tables (worlds, world_access).

---

_End of schema reference._
