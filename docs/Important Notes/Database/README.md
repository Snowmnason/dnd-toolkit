# Database Documentation

Reference for database schema, tables, and indexes.

## Contents

- **[SCHEMA.md](SCHEMA.md)** - Core tables, columns, constraints, and RLS policies
- **[INDEXES.md](INDEXES.md)** - Index reference for quick performance lookups

## Quick Overview

### Core Tables

- **users** - App users linked to Supabase auth
- **worlds** - Campaign worlds owned by users
- **world_access** - User membership and roles in worlds
- **invite_links** - Shareable links for world invitations

### Key Concepts

- **Row Level Security (RLS)** - Fine-grained access control at the database level
- **Foreign Keys** - Relationships between tables (cascade on delete)
- **Indexes** - Performance optimization for common queries
- **Auth Integration** - Links to Supabase `auth.users` table

## For Developers

Start with [SCHEMA.md](SCHEMA.md) to understand the data model, then refer to [INDEXES.md](INDEXES.md) when optimizing queries.
