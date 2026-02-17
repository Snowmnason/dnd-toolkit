# Adaptive Payload Testing Guide

**Issue:** #205 - Adaptive Payload Sizing Based on Connection Quality  
**Phase:** 3 (Testing Guide)  
**Last Updated:** February 2026

---

## Overview

This guide documents manual testing procedures for adaptive payload sizing feature. Tests verify:
- Quality tier mapping (4g → HD, 3g → SD, 2g → thumb)
- Payload size reduction (≥50% on 2G vs 4G)
- Cache key differentiation (quality stored separately)
- Auto-refetch on quality change
- Offline behavior (text-only payloads)

---

## Environment Setup

### Prerequisites
- VS Code with dnd-toolkit workspace open
- Development server running (`npm run start`)
- DevTools or mobile dev tools available

### Web Testing (Chrome/Firefox)

1. Open DevTools (F12)
2. Go to **Network** tab
3. Click **Throttling** dropdown (usually shows "No throttling")
4. Select throttling profile:
   - **Fast 3G:** ~1.6Mbps down, 750Kbps up (3G simulation)
   - **Slow 3G:** ~400Kbps down, 400Kbps up (poor 3G/slow 2G)
   - **Offline:** No connectivity

### iOS Testing
- **Option 1:** Xcode Network Link Conditioner (install from Apple)
  - Provides fine-grained network simulation
  - Can set bandwidth, latency, packet loss
- **Option 2:** Test on actual cellular network
- **Option 3:** iPhone Developer Settings → Simulate Networks

### Android Testing
- **Setting:** Developer Options → "Simulate Poor Network" or similar
- **Alternative:** Test on actual WiFi/cellular with speed measurements
- **Tool:** NetworkBench or similar network diagnostics

---

## Test Cases

### Test 1: Connection Quality → Payload Quality Mapping

**Objective:** Verify correct quality tier selected for each connection speed

**Test Steps:**

#### 1.1 On 4G Connection
```
Setup:
- DevTools Throttling: "Fast 4G" or "No throttling" (best case)
- Navigate to /main/worlds or similar worlds list screen

Expected:
- Network tab shows query params include: imageQuality=hd (or no param)
- Images load at full resolution
- Maps visible
- Full descriptions displayed

Verification:
- Right-click request → Copy as cURL → paste to terminal
- Check URL includes: ?imageQuality=hd (or absent for default)
```

**Pass Criteria:**
- ✅ Query params show `imageQuality=hd` or default (hd)
- ✅ Network timeline shows requests complete <2 seconds
- ✅ Maps and full details visible

#### 1.2 On 3G Connection
```
Setup:
- DevTools Throttling: "Regular 3G"
- Reload worlds list page

Expected:
- Query params include: imageQuality=sd&excludeMaps=true
- Images load at reduced resolution (smaller file sizes)
- Maps hidden
- Full descriptions shown

Verification:
- Network tab → Filter to XHR requests
- Inspect URL query parameters
```

**Pass Criteria:**
- ✅ Query shows `imageQuality=sd`
- ✅ Query shows `excludeMaps=true`
- ✅ Request completes <5 seconds
- ✅ File sizes ~30-40% reduction from HD

#### 1.3 On 2G/Slow Connection
```
Setup:
- DevTools Throttling: "Slow 3G" (simulates poor 2G)
- Reload worlds list page

Expected:
- Query params include: imageQuality=thumb&summaryOnly=true&excludeMaps=true&maxPayloadBytes=512000
- Thumbnails only (small placeholder images)
- No maps
- Summaries only (no full descriptions)
- Total payload <500KB

Verification:
- Check DevTools Network tab for params
- Inspect response payload size
```

**Pass Criteria:**
- ✅ Query shows `imageQuality=thumb`
- ✅ Query shows `summaryOnly=true`
- ✅ Query shows `excludeMaps=true`
- ✅ Response payload <500KB
- ✅ Request completes <8 seconds (slow connection)

#### 1.4 Offline
```
Setup:
- DevTools: Click throttling → "Offline"
- Navigate to or reload worlds list

Expected:
- RequestManager queues request to offline queue
- UI shows "No data available" or cached data from before
- Text-only payload prepared (logs show imageQuality=text-only)
- No images downloaded

Verification:
- DevTools Console: Check logs for "queued for offline replay"
- RequestManager should detect offline and queue
```

**Pass Criteria:**
- ✅ Request doesn't fail; returns null or cached data gracefully
- ✅ Offline queue entry created
- ✅ No image/map downloads attempted

---

### Test 2: Quality Change Triggers Cache Invalidation & Refetch

**Objective:** Verify that switching network quality (e.g., 4G → 2G) refetches data with new params

**Test Steps:**

```
Setup:
- DevTools Network tab open (to observe requests)
- DevTools Throttling: "Fast 4G"
- Navigate to /main/worlds

Step 1: Load on 4G
- Let page fully load
- Observe Network tab: first request has imageQuality=hd
- Note: Data cached in browser

Step 2: Switch to 2G
- Change DevTools Throttling to "Slow 3G"
- Observe Network tab IMMEDIATELY after throttling change
- **Expected:** New request appears with imageQuality=thumb

Step 3: Verify Data Update
- Page should show thumbnails after new request completes
- Maps should be hidden
- Descriptions should be summaries only

Verification:
- Before: 4-5 requests for images at HD resolution
- After: 1 request for thumbnails, images not loaded individually
- Cache keys differ: worlds:list:4g vs worlds:list:2g
```

**Pass Criteria:**
- ✅ Cache invalidates immediately when quality changes
- ✅ New request sent with updated quality params
- ✅ UI updates to reflect new quality (images shrink, details disappear)
- ✅ No duplicate requests

**Timing:**
- Quality change detected within 100-500ms
- New request initiated within 1 second
- Data replaces on-screen within 5 seconds (network dependent)

---

### Test 3: Cache Keys Differ Per Quality (No Wrong Quality Served)

**Objective:** Verify HD and SD versions cached separately

**Test Steps:**

```
Setup:
- Open DevTools → Application → Cache Storage (or Storage → LocalStorage if using local storage)
- DevTools Throttling: "Fast 4G"
- Navigate to /main/worlds

Step 1: Load on 4G
- Wait for data to load
- Check cache: should have entry like worlds:list:4g

Step 2: Switch to 2G
- Change throttling to "Slow 3G"
- Wait for data to reload
- Check cache: should have NEW entry worlds:list:2g

Step 3: Switch back to 4G
- Change throttling back to "Fast 4G"
- OLD cached HD data should be served (not the 2G version)

Verification:
- Two distinct cache entries exist
- Switching between qualities shows appropriate data immediately (from cache) or loads fresh
```

**Pass Criteria:**
- ✅ Cache has separate entries for worlds:list:4g and worlds:list:2g
- ✅ Switching quality uses correct cached version
- ✅ No HD images shown on 2G connection
- ✅ No thumbnails shown on 4G connection

---

### Test 4: Maps Show/Hide Based on Quality

**Objective:** Verify maps excluded on poor connections

**Test Steps:**

```
Setup:
- Navigate to a screen with maps (e.g., world details view)
- Open DevTools Network tab

Step 1: Load on 4G
- DevTools Throttling: "Fast 4G" (or no throttling)
- Load world details
- Verify maps visible
- Check Network tab: no excludeMaps param (or excludeMaps=false)

Step 2: Switch to 2G
- Change DevTools Throttling to "Slow 3G"
- Page should refetch and hide maps
- Check Network tab: excludeMaps=true in query params
- Maps component should unmount or show placeholder

Verification:
- Compare Network requests: 4G has map tiles, 2G doesn't
- UI shows/hides map conditionally based on payloadOptions.includeMaps
```

**Pass Criteria:**
- ✅ Maps visible on 4G, hidden on 2G
- ✅ Query params reflect expected state
- ✅ UI updates within 2-3 seconds of quality change

---

### Test 5: Payload Size Reduction Verification

**Objective:** Measure actual file size reduction from HD to 2G

**Test Steps:**

```
Setup:
- Open DevTools Network tab
- Open DevTools Console → Network tab → Filter "XHR" or "Fetch"

Step 1: Measure 4G Payload
- DevTools Throttling: "Fast 4G"
- Load /main/worlds (full list)
- Note total bytes downloaded:
  - Click first XHR request for /api/worlds
  - Check Response size (e.g., 2.5MB)

Step 2: Clear Cache & Reload on 2G
- Clear browser cache (DevTools → Storage → Clear site data)
- Change throttling to "Slow 3G"
- Load /main/worlds again
- Note total bytes:
  - Check response size (should be ~500KB)

Step 3: Calculate Reduction
- 4G response: 2500KB
- 2G response: 500KB
- Reduction: (2500 - 500) / 2500 = 80% reduction ✓

Verification:
- Actual reduction ≥50% (target is 50-80%)
- File size appropriate for quality tier (HD largest, thumb smallest)
```

**Pass Criteria:**
- ✅ 4G payload ≥2MB
- ✅ 2G payload <600KB (ideally <500KB)
- ✅ Size reduction ≥50%
- ✅ Smaller payloads correlate with "thumb" quality

---

### Test 6: requestManager Auto-Injection Works

**Objective:** Verify RequestManager automatically appends adaptive params to HTTP URLs

**Test Steps:**

```
Setup:
- DevTools Network tab open
- Page using RequestManager for HTTP-like URLs

Action:
- Load any page with adaptive-supported endpoint
- Inspect Network requests

Verification:
- HTTP GET requests include query params: imageQuality, excludeMaps, summaryOnly, maxPayloadBytes
- Internal cache keys (worlds:list) don't get params appended (as expected)
- Params vary based on current network quality
```

**Pass Criteria:**
- ✅ HTTP requests auto-inject params
- ✅ Cache key requests don't get auto-injection (or appropriately handled)
- ✅ Params accurately reflect network quality

---

### Test 7: Manual Throttling Profile Changes

**Objective:** Verify smooth transitions between different network speeds

**Test Steps:**

```
Setup:
- DevTools Network tab open
- Page with adaptive payloads displayed

Sequence:
1. Start on "Fast 4G" (full resolution images)
2. Switch to "Regular 3G" (medium resolution, no maps)
3. Switch to "Slow 3G" (thumbnails, summaries)
4. Switch to "Offline"
5. Switch back to "Fast 4G"

At each step:
- Observe Network tab for new requests
- Check that quality params change
- Verify UI updates appropriately
- Check no errors in Console
```

**Pass Criteria:**
- ✅ All transitions smooth (no errors or warnings)
- ✅ Correct params sent at each step
- ✅ UI reflects quality changes within 2-5 seconds
- ✅ No requests sent when offline

---

## Platform-Specific Testing

### Web (Chrome/Firefox/Safari)

**Why test all browsers?**
- Network Information API may vary
- Browser caching behavior differs

**Test Checklist:**
- ✅ Chrome (DevTools throttling)
- ✅ Firefox (Network throttling)
- ✅ Safari (Safari DevTools → Network)
- ✅ Edge (similar to Chrome)

### iOS (iPhone/iPad)

**Setup:**
1. Install Xcode
2. Download Network Link Conditioner from Apple Development Resources
3. Install on iOS device
4. Configure network profile (custom bandwidth, latency, packet loss)

**Test Steps:**
- Launch Network Link Conditioner
- Select "Poor Network" or custom profile
- Load app
- Verify adaptive params in request headers (use proxy like Charles)
- Check image sizes and response times

### Android (Phone/Tablet)

**Setup:**
1. Enable Developer Options (Settings → About → Tap Build 7x)
2. Go to Developer Options → Simulate Poor Network / Advanced Networking
3. OR use Android emulator with built-in network simulation

**Test Steps:**
- Enable poor network simulation
- Navigate app screens
- Open Chrome DevTools (remote debugging)
- Verify adaptive params in requests
- Measure response times

---

## Success Criteria Summary

| Test | Pass Criteria |
|------|---|
| 1.1: 4G Quality | imageQuality=hd, maps visible, <2s |
| 1.2: 3G Quality | imageQuality=sd, excludeMaps=true, <5s |
| 1.3: 2G Quality | imageQuality=thumb, summaryOnly=true, <500KB |
| 1.4: Offline | Queued to offline queue, text-only payload |
| 2: Quality Change | Cache invalidation, new request, UI update within 5s |
| 3: Cache Keys | Separate entries per quality, no wrong quality served |
| 4: Maps Show/Hide | 4G shows maps, 2G hides maps |
| 5: Size Reduction | ≥50% reduction (2G vs 4G), appropriate per tier |
| 6: Auto-Injection | HTTP URLs get params, cache keys handle correctly |
| 7: Throttling Changes | Smooth transitions, correct params, no errors |

---

## Known Issues & Workarounds

### Issue: Network Change Not Detected
**Symptom:** Switching throttling profile doesn't trigger cache invalidation  
**Cause:** NetworkDetection subscription not working  
**Workaround:** Manual page refresh (F5) to test with new quality

### Issue: Maps Still Load on 2G
**Symptom:** Maps component ignores excludeMaps param  
**Cause:** Server doesn't support param OR UI not checking payloadOptions  
**Workaround:** Check UI component for proper conditional rendering

### Issue: Wrong Cached Data Served
**Symptom:** HD images shown on 2G after switching from 4G  
**Cause:** Cache keys don't include quality tier  
**Workaround:** Use getQualityAwareCacheKey() helper

---

## Performance Baselines

| Metric | Target | 4G | 3G | 2G |
|--------|--------|-----|------|------|
| Response Time | <8s | <2s | <5s | <8s |
| Payload Size | - | 2.5MB | 1.2MB | 500KB |
| Images | Full | HD | SD | Thumb |
| Maps | Yes | Yes | No | No |
| Details | Full | Full | Full | Summary |

---

## Reporting Results

When reporting test results:
```
Browser: Chrome 12x (web) / iOS 17 (mobile)
Throttling Profile: Slow 3G
Test ID: 1.3 - 2G Quality
Status: ✅ PASS / ❌ FAIL

Expected: imageQuality=thumb, <500KB payload
Actual: [actual params/size]
Notes: [any observations]
```

---

## Checklists

### Pre-Release Testing
- [ ] All 7 test cases passing on Chrome
- [ ] All 7 test cases passing on Firefox
- [ ] All 7 test cases passing on Safari
- [ ] iOS physical device test (4G, 2G, offline)
- [ ] Android physical device test (4G, 2G, offline)
- [ ] No console errors or warnings
- [ ] Response times within baselines
- [ ] Offline queue integration working
- [ ] Cache keys properly differentiated

### Regression Testing (After Changes)
- [ ] Quality tier mapping unchanged (4g→hd, 2g→thumb, etc.)
- [ ] Cache invalidation still triggers on quality change
- [ ] Network params still injected correctly
- [ ] No performance regressions (response times unchanged)
- [ ] Offline queue still works

