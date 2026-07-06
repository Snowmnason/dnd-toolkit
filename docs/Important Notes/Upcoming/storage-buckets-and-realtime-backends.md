# Storage Buckets And Realtime Backends

Future implementation note for the deferred backend adapters introduced by the repository-pattern work.

## Current Status

The abstractions exist, but the live backend adapters are still stubs.

### Storage Buckets

- registry support exists in `system/Storage/buckets/registry.ts`
- semantic bucket operations exist in `lib/storage/buckets/operations.ts`
- the Supabase buckets provider exists at `system/Services/supabase/supabase-buckets-provider.ts`
- that provider is still explicitly marked as deferred and throws placeholder errors

### Realtime

- realtime registry support exists in `lib/realtime/registry.ts`
- semantic operations and README guidance exist in `lib/realtime/`
- the Supabase realtime provider exists at `system/Services/supabase/supabase-realtime-provider.ts`
- those handlers are still placeholder stubs and are not registered in bootstrap

## What This Means

This is not missing architecture. It is missing backend implementation.

The repo already chose the pattern:

- semantic registry at the app layer
- provider-specific backend adapter at the service layer
- future registration during bootstrap

What is still absent is the actual Supabase API wiring.

## Storage Bucket Follow-Ups

Still pending:

- actual upload calls
- actual download calls
- delete and list behavior
- public URL generation
- error handling and retry behavior
- any image-specific optimization or metadata handling layered onto storage

## Realtime Follow-Ups

Still pending:

- actual channel subscription logic
- unsubscribe lifecycle
- message parsing and payload shaping
- connection and reconnection handling
- bootstrap registration of the realtime handlers

## Example Future Bootstrap Shape

```ts
const bucketsAdapter = createSupabaseBucketsAdapter();
registerBucketOperation('uploadImage', bucketsAdapter.uploadImageOperation());

const realtimeAdapter = createSupabaseRealtimeAdapter();
registerRealtimeHandler('WORLD_UPDATED', realtimeAdapter.createWorldUpdatedHandler());
```

That pattern is already documented in the placeholder files. What is missing is the real provider behavior behind those registrations.

## Priority

Medium.

These follow-ups matter when the app starts depending on bucket-backed assets or realtime subscriptions through the new abstraction layer. Until then, they remain intentionally deferred infrastructure.