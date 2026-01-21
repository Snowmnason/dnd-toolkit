/\*\*

- Electron API Memory Leak Prevention Guide
-
- This file documents the pattern required to safely use the Electron API's
- onThemeChange() method and prevent memory leaks from event listener accumulation.
-
- ============================================================================
- CRITICAL ISSUE: Memory Leaks from Event Listeners
- ============================================================================
-
- The Electron preload API exposes `window.electronAPI.onThemeChange()` which
- returns a cleanup function. This cleanup function MUST be called when the
- component unmounts to prevent memory leaks.
-
- WITHOUT cleanup:
- ```

  ```
- Mount component → Add listener
- Unmount component → Listener REMAINS (❌ Memory leak)
- Remount component → Add another listener
- Unmount component → 2 listeners REMAIN (❌ Growing memory leak)
- ```

  ```
-
- WITH cleanup:
- ```

  ```
- Mount component → Add listener
- Unmount component → Call cleanup → Listener REMOVED (✅ Clean)
- Remount component → Add new listener
- Unmount component → Call cleanup → Listener REMOVED (✅ Clean)
- ```

  ```
-
- ============================================================================
- PATTERN 1: Direct Usage (Discouraged - use Pattern 2 instead)
- ============================================================================
-
- If using onThemeChange() directly in a component (not recommended):
-
- ```tsx

  ```
- import { useEffect, useState } from 'react';
-
- export function MyComponent() {
- const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
-
- useEffect(() => {
-     const cleanup = window.electronAPI.onThemeChange((newTheme) => {
-       setTheme(newTheme);
-     });
-     return cleanup; // ⭐ CRITICAL: Call cleanup on unmount
- }, []);
-
- return <div>Theme: {theme}</div>;
- }
- ```

  ```
-
- Key points:
- - ALWAYS store the return value of onThemeChange()
- - ALWAYS call it in the useEffect cleanup function
- - Return it from useEffect (React calls it on unmount)
-
- ============================================================================
- PATTERN 2: Using the Hook (Recommended)
- ============================================================================
-
- Use the provided `useSystemThemeSync()` hook which handles cleanup:
-
- ```tsx

  ```
- import { useSystemThemeSync } from '@/desktop/src/hooks/useSystemThemeSync';
-
- export function MyComponent() {
- const { systemTheme, isElectron } = useSystemThemeSync({
-     debug: true, // Optional: log theme changes
-     onThemeChange: (theme) => {
-       console.log('Theme changed to:', theme);
-       // Additional side effects here
-     },
- });
-
- if (!isElectron) return null; // Skip on web
-
- return <div>System Theme: {systemTheme}</div>;
- }
- ```

  ```
-
- The hook handles:
- - ✅ Storing and calling the cleanup function
- - ✅ Proper useEffect cleanup
- - ✅ Electron detection
- - ✅ Initial theme loading
- - ✅ Optional debugging
-
- ============================================================================
- ERROR SIGNS: When Cleanup is Missing
- ============================================================================
-
- Watch for these signs of memory leaks:
-
- 1.  **Duplicate Callbacks**: If you see multiple logs for one theme change:
- ```

  ```
- Theme changed to: dark
- Theme changed to: dark
- Theme changed to: dark // ❌ Should only log once
- ```

  ```
- This means multiple listeners are registered from re-mounts
-
- 2.  **Memory Growth**: Monitor memory in DevTools:
- - Mount → Unmount → Remount → Memory keeps growing
- - Heapdump shows multiple identical listener functions
-
- 3.  **Console Spam**: If using debug logging:
- ```

  ```
- [useSystemThemeSync] Theme changed to: dark
- [useSystemThemeSync] Theme changed to: dark
- [useSystemThemeSync] Theme changed to: dark // ❌ Multiple listeners
- ```

  ```
-
- ============================================================================
- API SIGNATURES
- ============================================================================
-
- Preload API (desktop/src/preload.ts):
- ```typescript

  ```
- window.electronAPI.onThemeChange(
- callback: (theme: 'light' | 'dark') => void
- ): () => void // Returns cleanup function
- ```

  ```
-
- Hook API (desktop/src/hooks/useSystemThemeSync.ts):
- ```typescript

  ```
- useSystemThemeSync(options?: {
- onThemeChange?: (theme: 'light' | 'dark') => void;
- debug?: boolean;
- }): {
- systemTheme: 'light' | 'dark' | null;
- isElectron: boolean;
- isLoaded: boolean;
- }
- ```

  ```
-
- ============================================================================
- IMPLEMENTATION CHECKLIST
- ============================================================================
-
- When adding a component that listens to theme changes:
-
- - [ ] Use `useSystemThemeSync()` hook (not direct API)
- - [ ] Check that systemTheme is used in render
- - [ ] Verify isElectron guard prevents errors on web
- - [ ] Test component mount/unmount cycles
- - [ ] Open DevTools → Console, look for duplicate logs
- - [ ] Check DevTools → Memory, verify no heap growth
-
- ============================================================================
- RELATED FILES
- ============================================================================
-
- - desktop/src/preload.ts - Electron API implementation
- - desktop/src/hooks/useSystemThemeSync.ts - Recommended hook pattern\n _ - desktop/src/main.ts - IPC handler for theme-changed event\n _/\n\n// This file is documentation only and doesn't export anything.\nexport {};\n
