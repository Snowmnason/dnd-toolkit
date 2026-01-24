# DO SOON: Implement Custom Ping Endpoint

## Current Implementation

The network detection system uses **Cloudflare's free trace endpoint** (`https://www.cloudflare.com/cdn-cgi/trace`) for connectivity testing during periodic pings (every 5 minutes on web).

## Why This Needs Updating

- Cloudflare endpoint is external and not under your control
- Doesn't correlate with your actual app infrastructure availability
- Could change or go down without notice
- Privacy consideration: all network checks leak to Cloudflare

## What to Do

Create a lightweight health-check endpoint in your own infrastructure that:

### Option 1: Supabase Edge Function (Recommended)

```bash
# Create an Edge Function
supabase functions new ping-health-check
```

Minimal implementation:

```typescript
// supabase/functions/ping-health-check/index.ts
Deno.serve(async (req) => {
  return new Response("pong", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
});
```

### Option 2: Simple Backend Endpoint

If using Express or similar:

```typescript
app.get("/api/health-check", (req, res) => {
  res.status(200).send("ok");
});
```

### Option 3: Existing GitHub Pages Endpoint

If you have a static JSON file on GitHub Pages:

```json
// gh-pages health check
{ "status": "ok" }
```

## Implementation Steps

1. Create your endpoint
2. Test it with `curl https://your-endpoint/path`
3. Update `performWebPing()` in `lib/network/network-detection.ts` line ~397
4. Replace the Cloudflare URL with your endpoint
5. Test network detection on web platform

## Current Cloudflare Usage (Temporary)

Find in: `lib/network/network-detection.ts` line ~397

```typescript
const response = await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
  method: "GET",
  signal: controller.signal,
});
```

## Timeline

- **Urgent**: No - current solution works and is free
- **Priority**: Medium - implement when setting up production backend
- **Dependency**: None - works independently

## Notes

- Endpoint only needs to return HTTP 200 status
- Minimal response body (under 1KB ideal)
- Will be called every 5 minutes on web platform
- Used for latency measurement and connectivity verification
