# Text Scale Flicker Investigation

## Problem Summary
Text in `StyleDesktop.tsx` flickers on first render. The same flicker was originally observed in the Notification system, leading us to disable it. However, the issue appears to be a broader problem with how `useScale()` interacts with text components on initial render.

## Root Cause Analysis

### The Core Issue: ScaleProvider Double-Render
The flicker is **not** caused by notifications re-rendering the screen. Instead, it's caused by a **two-phase scale initialization** in `ScaleProvider`:

```typescript
// providers/ScaleProvider.tsx
export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(getScale())  // Phase 1: Initial scale

  useEffect(() => {
    const onChange = ({ window }: any) => {
      setScale(getScale({ width: window.width }))  // Phase 2: Corrected scale
    }
    const sub = Dimensions.addEventListener('change', onChange)
    return () => sub?.remove?.()
  }, [])

  const sizing = useMemo(() => buildSizing(scale), [scale])  // Rebuilds when scale changes

  return (
    <ScaleContext.Provider value={sizing}>
      {children}
    </ScaleContext.Provider>
  )
}
```

**What happens on web:**
1. **First render**: `useState(getScale())` runs and calculates scale based on `Dimensions.get('window').width`
2. **Browser layout pass**: React Native Web measures the actual DOM
3. **useEffect fires**: The dimension listener is set up
4. **Dimensions "change" event**: Even without a resize, RN Web may fire this event once actual measurements are available
5. **Scale recalculates**: `setScale()` triggers with potentially different width value
6. **Components re-render**: All text components using `useScale()` get new font sizes
7. **Visual flicker**: Text briefly renders at initial size, then "snaps" to final size

### Why It Happens Specifically on StyleDesktop

`StyleDesktop.tsx` has:
- **Heavy use of typography components**: Title, Heading, Body, SubTitle, Caption, etc.
- **Many components per screen**: Each calling `useScale()` via `const S = useScale()`
- **Nested scroll views**: Both left and right panels render simultaneously
- **Text-heavy UI**: Almost every surface/card has multiple text elements

The flicker is more noticeable here because:
1. More text = more visible scale changes
2. All text re-renders at once when scale updates
3. The contrast between sizes is more obvious with multiple heading levels

### Why Notifications Seemed to Cause It

Notifications **appeared** to cause the issue because:
- They were an additional component mounting after bootstrap
- Their mount triggered a layout pass
- This layout pass coincided with the scale recalculation timing
- **Correlation, not causation**: Removing notifications reduced the total number of components affected by the flicker, but didn't fix the root cause

## Evidence

### 1. ScaleProvider State Changes
```typescript
// Initial render
scale = getScale()  // e.g., 1.0 (calculated from initial window.width)

// After useEffect + Dimensions event
scale = getScale({ width: actualWidth })  // e.g., 1.05 (slightly different)

// This triggers:
sizing = buildSizing(1.05)  // All font/space values recalculate
```

### 2. AppText Component Behavior
Every text component does:
```typescript
const S = useScale()  // Gets current sizing object from ScaleProvider

const resolvedFontSize = (() => {
  if (typeof fontSize === 'string' && fontSize.startsWith('$')) {
    const token = fontSize.slice(1) as keyof typeof S.font
    const tokenValue = S.font[token]  // <-- This value changes when scale updates
    if (typeof tokenValue === 'number') {
      return tokenValue
    }
  }
  return Number(fontSize)
})()
```

When `S` changes, **all** text components re-render with new sizes.

### 3. Timing on Web
On React Native Web specifically:
- Initial `Dimensions.get('window').width` may not reflect actual layout width
- DOM measurement happens asynchronously
- The "change" event fires once measurements stabilize
- This creates a visible "snap" as text adjusts from initial to final size

### 4. Why Mobile Doesn't Flicker (as much)
On native platforms:
- Initial dimensions are more accurate
- Less discrepancy between initial and final measurements
- Native rendering is faster, hiding the transition
- `getMobileScale` uses `mobileBase = 0.85` and `useWidth = false` by default, reducing sensitivity

## Why Common Fixes Didn't Work

### Removing Animations
- **Tried**: Removed Reanimated from Notification
- **Result**: Flicker persisted
- **Reason**: The flicker is from React state changes in ScaleProvider, not animation callbacks

### Memoization
- **Tried**: Memoized NotificationContainer
- **Result**: No change
- **Reason**: Memoization doesn't prevent parent (ScaleProvider) from updating child context

### Moving Container Position
- **Tried**: Changed where NotificationContainer rendered in tree
- **Result**: No change
- **Reason**: All components share the same ScaleContext; position in tree doesn't matter

### Removing Notifications Entirely
- **Tried**: Disabled NotificationProvider/Container
- **Result**: Flicker reduced but still visible on StyleDesktop
- **Reason**: Notifications were a red herring; the real issue is in ScaleProvider affecting all text

## Possible Solutions

### Option 1: Initialize ScaleProvider with Accurate Dimensions (Recommended)
Wait for layout before rendering scale-dependent content:

```typescript
export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState<number | null>(null)  // Start null
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Wait for next frame to get accurate dimensions
    requestAnimationFrame(() => {
      const initialScale = getScale()
      setScale(initialScale)
      setIsReady(true)
    })

    const onChange = ({ window }: any) => {
      setScale(getScale({ width: window.width }))
    }
    const sub = Dimensions.addEventListener('change', onChange)
    return () => sub?.remove?.()
  }, [])

  if (!isReady || scale === null) {
    return <View style={{ flex: 1 }} />  // Blank until ready
  }

  const sizing = buildSizing(scale)
  return (
    <ScaleContext.Provider value={sizing}>
      {children}
    </ScaleContext.Provider>
  )
}
```

**Pros**: Eliminates initial incorrect scale
**Cons**: Adds minimal delay (~16ms) before content appears

### Option 2: Use Static Scale on Web
Disable dynamic scaling for web to avoid recalculation:

```typescript
// In getWebScale
export function getWebScale(opts: ScaleOptions = {}) {
  const {
    useWidth = false,  // <-- Change default to false on web
    width: w = Dimensions.get('window').width,
    baseline = 1280,
    min = 0.95,
    max = 1.6,
    webBase = 1,
  } = opts
  // ...
}
```

**Pros**: No flicker; web uses fixed scale
**Cons**: Loses responsive scaling on web

### Option 3: Transition Instead of Snap
Add a very fast transition to make the change less jarring:

```typescript
// In AppText
<Animated.Text 
  entering={FadeIn.duration(100)}
  style={[textStyle, animatedStyle]}
>
  {children}
</Animated.Text>
```

**Pros**: Flicker becomes a smooth transition
**Cons**: Adds Reanimated dependency to all text; may feel sluggish

### Option 4: Cache Initial Scale in SessionStorage (Web Only)
On web, save the calculated scale after first load:

```typescript
export function ScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const cached = window.sessionStorage.getItem('dnd_scale')
      if (cached) return parseFloat(cached)
    }
    return getScale()
  })

  useEffect(() => {
    const onChange = ({ window }: any) => {
      const newScale = getScale({ width: window.width })
      setScale(newScale)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.sessionStorage.setItem('dnd_scale', newScale.toString())
      }
    }
    // ...
  }, [])
  // ...
}
```

**Pros**: Subsequent page navigations use correct scale immediately
**Cons**: First visit still flickers; adds platform-specific code

## Recommendations

### Short-term (Immediate)
**Option 1**: Use `requestAnimationFrame` to delay ScaleProvider initialization by one frame. This is the minimal fix that should eliminate most flicker.

### Medium-term (If Option 1 Isn't Enough)
**Option 2**: Make web scaling static by default (`useWidth = false` in `getWebScale`). Users can still resize browser, but initial load won't recalculate.

### Long-term (If You Want Responsive + Smooth)
**Hybrid approach**:
1. Use cached scale on web for instant load
2. Add a 100ms fade transition when scale changes (only for significant deltas, e.g., >0.05)
3. Debounce Dimensions listener (e.g., 150ms) to avoid rapid recalculations during resize

## Conclusion

**The notifications were innocent.** The flicker is caused by `ScaleProvider` recalculating scale after initial render when accurate dimensions become available on React Native Web. This affects **all text components**, but is most visible on text-heavy screens like StyleDesktop.

**You can safely re-enable notifications** if you implement Option 1 above. The real fix is to ensure ScaleProvider starts with the correct scale value, which requires waiting one frame for accurate dimensions on web.

## Test Plan

To verify the fix:
1. Apply Option 1 (requestAnimationFrame delay)
2. Hard refresh StyleDesktop on web
3. Observe if text still flickers on load
4. Re-enable NotificationProvider/Container
5. Trigger a notification
6. Confirm no additional flicker occurs

If flicker persists after Option 1, proceed to Option 2 (static web scale).
