# Users API Zod Migration

Concrete reminder for the first schema-driven API client cleanup.

## Why This Note Exists

`lib/api/client-factory.ts` already supports `responseSchema` for both queries and mutations.

When a schema is passed, the base `APIClient` calls `responseSchema.parse(data)` before returning the result. That means the runtime validation infrastructure already exists.

What is still missing is consistent adoption in the concrete clients.

## First Recommended Target

The best first slice is `lib/api/clients/users.ts`.

Why this file is a good candidate:

- it is small and isolated
- it already exposes a clear response shape through the `User` interface
- it already exposes a simple request shape through `UpdateUserRequest`
- it has both read and write methods, so it can show the full pattern without touching too much surface area

## Current Shapes In UsersAPI

The file currently defines:

- `User`
  - `id`
  - `email`
  - `name`
  - `createdAt`
  - `is_admin`
- `UpdateUserRequest`
  - `name?`
  - `email?`

It then uses those hand-written types in:

- `getCurrentUser()`
- `getUser(userId)`
- `updateUser(userId, data)`

## What The Future Cleanup Should Do

The goal is not to change behavior. The goal is to make the type contract come from schemas instead of duplicated interfaces.

Target pattern:

1. define a Zod schema for the user response payload
2. infer the `User` type from that schema with `z.infer<typeof UserSchema>`
3. define a Zod schema for the update request payload if the client should validate request shapes too
4. pass `responseSchema: UserSchema` into the matching `query()` and `mutation()` calls

That would make `UsersAPI` the first real example of schema-first API client usage in the repo.

## Why UsersAPI First

This is the safest way to prove the pattern because it keeps the scope narrow.

- no need to convert every client at once
- no need to refactor `APIClient` itself
- no need to guess where the pattern should start

If the pattern feels right in `UsersAPI`, the same approach can later be applied to `WorldsAPI` and any future API clients.

## Existing Repo Pattern To Follow

The repo already uses Zod inference successfully in the validation layer.

Examples:

- `validation/auth.schema.ts`
- `validation/world.schema.ts`

Those files already show the preferred shape:

- schema first
- `z.infer<>` for the TypeScript type
- one source of truth for runtime validation and static typing

## Suggested Future Slice

When this becomes implementation work later, keep it narrow:

1. start with `getCurrentUser()` and `getUser()`
2. add one shared `UserSchema`
3. infer `User` from that schema
4. wire `responseSchema` into those read methods
5. only then decide whether `updateUser()` should also validate request payloads or just response payloads first

## What This Would Prevent

Without this pattern, the repo can drift into a state where the interface says one thing and the backend returns another.

With the schema-driven version:

- TypeScript types come from the schema
- malformed backend payloads fail immediately
- future client examples stop teaching the duplicated-interface pattern

## Priority

Medium.

This is a good cleanup target when touching the API layer, but it is not urgent unless payload mismatches are already causing bugs.