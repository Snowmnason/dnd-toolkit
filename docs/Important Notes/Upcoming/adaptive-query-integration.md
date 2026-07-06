# Adaptive Query Integration

Reminder for the adaptive-payload work that has already landed and the smaller follow-up that still remains.

## Current Status

The important integration work is already live in the query layer.

- `hooks/storage/queries/use-worlds-query.tsx` uses `getQualityAwareCacheKey()`.
- `hooks/storage/queries/use-worlds-query.tsx` also calls `useAdaptivePayloadCacheInvalidation()` so cache entries are refreshed when network quality changes.
- `hooks/storage/queries/use-users-query.tsx` uses the same pattern for user queries.
- `lib/network/adaptive-payload/adaptive-payload-integration.ts` is the shared helper surface for quality-aware cache keys and related behavior.

## What Was Actually Solved

This means the app already does the most important part of the rollout:

- different network-quality tiers can map to different cache keys
- cache invalidation can react to quality changes
- hooks can opt into the same pattern without each one inventing its own logic

That is the hard architectural part. This note is no longer about "we still need adaptive query support." That support exists.

## What Is Still Incomplete

The part that is still only partial is payload shaping at fetch time.

- `useWorldsQuery` already calls `getAdaptiveQueryParams()`.
- the current `worldsDB` calls do not consume those params yet
- most current data access here is still local or database-wrapper driven, so there is not much payload variation to apply yet
- quality-specific stale-time tuning is still optional follow-up, not missing core behavior

In other words, the cache behavior is adaptive, but the actual returned payload is not yet meaningfully lighter or heavier based on quality.

## Server-Side And Asset Gaps

The older issue notes were still useful on one point: client-side adaptive behavior only pays off when backend or asset surfaces can honor it.

Important follow-ups that still appear relevant:

- image or asset variants are not yet a broadly implemented part of the adaptive flow
- server payloads do not appear to be widely reduced based on `imageQuality`, `excludeMaps`, or similar params
- there is no clear payload-size verification workflow proving the server returns meaningfully smaller variants

So the missing piece is not "adaptive payload support exists nowhere." The missing piece is that the backend side is still too shallow for the client-side quality tiers to produce their full benefit.

## Advanced Deferred Ideas

Still clearly future-facing:

- progressive loading or streaming quality upgrades
- manual override UI for forcing HD, SD, or thumb behavior
- upload-side optimization tied to adaptive asset strategies
- deeper analytics around payload savings by tier

## When To Revisit This

Revisit this only when a fetch path can truly change what it asks for.

Good candidates:

- REST endpoints that can omit heavy fields on weaker connections
- image or asset endpoints with size or quality variants
- large list endpoints where low-quality connections should fetch summaries first
- API-backed queries where stale time should differ by network quality

Example:

```text
4g request  → full image + richer fields
3g request  → medium image + lighter fields
2g request  → thumbnail or summary-first payload
offline     → cached or text-first fallback
```

## What A Real Follow-Up Would Look Like

If this becomes active work again, the likely next step is:

1. pick one query that talks to a backend surface that supports optional fields or payload shaping
2. thread `getAdaptiveQueryParams()` into that fetcher in a real way
3. verify that the cache key still matches the quality-dependent payload shape
4. only then decide whether quality-specific stale times are worth adding

## Priority

Low to medium.

This is not blocked work. The main integration already exists, and what remains is a selective optimization pass.