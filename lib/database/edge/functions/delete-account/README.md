# delete-account Edge Function

Reference copy of the Supabase Edge Function that permanently deletes the current user's account and server-side data.

## What Lives Here

This function performs the server-side part of the delete-account flow. The repo copy is kept for visibility and version tracking while the deployed function is still managed in the Supabase Dashboard.

## Key Responsibilities

- require an authenticated user JWT
- require password confirmation before destructive deletion
- delete the auth account and any cascading owned data
- return a single success or failure result that the app can complete locally

## Important Paths

- `index.txt` — reference function source
- `../README.md` — parent Edge Functions overview
- `hooks/auth/useSignOutFlow.ts` — UI-facing delete-account flow
- `lib/auth/account/delete-account-system.ts` — app-side delete-account orchestration
- `lib/database/repositories/SupabaseUserRepository.ts` — repository path that invokes the function

## Request And Response

- Method: `POST`
- Auth: required bearer token
- Body: `{ "password": "current-password" }`
- Success: `200` with a success message and deletion timestamp
- Common failures: `400` for missing password, `401` for invalid credentials or auth, `405` for wrong method, `500` for server-side failures

Example success payload:

```json
{
  "success": true,
  "message": "Account successfully deleted",
  "deletedAt": "2026-02-05T12:34:56.789Z"
}
```

## Related Modules

- `lib/auth/README.md`
- `lib/database/edge/README.md`
- `system/Services/README.md`
