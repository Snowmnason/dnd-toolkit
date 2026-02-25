# Implementing SecureStorage in Your Feature

This guide helps you integrate SecureStorage into your components or contexts.

## Checklist

- [ ] Import `SecureStorage` and `STORAGE_KEYS`
- [ ] Load data in `useEffect` 
- [ ] Use `setJSON` / `getJSON` for complex data
- [ ] Handle loading state
- [ ] Test on web and native platforms

## Step-by-Step Example

### 1. Add Storage Key (if needed)

Edit `lib/storage/index.ts`:

```typescript
export const STORAGE_KEYS = {
  // ... existing keys
  MY_FEATURE_CONFIG: 'dnd:feature:my_config',
} as const;
```

### 2. Import in Your Component/Hook

```typescript
import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
import { useEffect, useState } from 'react';
```

### 3. Load Data on Mount

```typescript
export function MyComponent() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      try {
        const saved = await SecureStorage.getJSON(STORAGE_KEYS.MY_FEATURE_CONFIG);
        setConfig(saved || { /* defaults */ });
      } catch (error) {
        logger.catogery("other").error('Failed to load config:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadConfig();
  }, []);

  if (loading) return <Loading />;
  
  return <div>{/* Use config */}</div>;
}
```

### 4. Save When Updated

```typescript
async function handleConfigChange(newConfig) {
  setConfig(newConfig);
  await SecureStorage.setJSON(STORAGE_KEYS.MY_FEATURE_CONFIG, newConfig);
}
```

## In Contexts

Example: Saving to storage when context value changes

```typescript
export function MyProvider({ children }) {
  const [state, setState] = useState(initialState);

  // Load on mount
  useEffect(() => {
    async function load() {
      const saved = await SecureStorage.getJSON(STORAGE_KEYS.MY_STATE);
      if (saved) setState(saved);
    }
    load();
  }, []);

  // Save on change
  const updateState = useCallback(async (newState) => {
    setState(newState);
    await SecureStorage.setJSON(STORAGE_KEYS.MY_STATE, newState);
  }, []);

  return (
    <Context.Provider value={{ state, updateState }}>
      {children}
    </Context.Provider>
  );
}
```

## Common Mistakes

### ❌ Using Effect Async Directly

```typescript
// Wrong: async effect
useEffect(async () => {
  const data = await SecureStorage.getJSON('key');
}, []);
```

### ✅ Correct Way

```typescript
// Right: inner async function
useEffect(() => {
  async function load() {
    const data = await SecureStorage.getJSON('key');
  }
  load();
}, []);
```

### ❌ Forgetting to Await

```typescript
// Wrong: Promise not awaited
SecureStorage.setJSON('key', value); // Missing await!
```

### ✅ Correct

```typescript
// Right: Always await storage operations
await SecureStorage.setJSON('key', value);
```

### ❌ Hardcoding Keys

```typescript
// Wrong
await SecureStorage.getJSON('myData');
```

### ✅ Use STORAGE_KEYS

```typescript
// Right
await SecureStorage.getJSON(STORAGE_KEYS.MY_DATA);
```

## Testing

### Mock SecureStorage

```typescript
import { SecureStorage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  SecureStorage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
    removeItem: jest.fn(),
    // ... other methods
  },
  STORAGE_KEYS: { /* keys */ },
}));

// In test
it('loads data on mount', async () => {
  (SecureStorage.getJSON as jest.Mock).mockResolvedValueOnce({
    theme: 'dark',
  });

  render(<MyComponent />);
  // ... assertions
});
```

## Platform-Specific Notes

### Web
- Data is encrypted in `localStorage`
- Synchronous under the hood, but wrapped in async API
- Works with dev tools localStorage inspector (shows encrypted values only)

### iOS/Android
- Data is encrypted in `AsyncStorage`
- Encryption keys stored in platform keychains (more secure)
- Async operations are truly async

### Desktop (Future)
- Will use Electron secure storage
- API remains the same
- Just update `lib/auth/encrypted-storage.ts`

## Performance Tips

### For App-Critical Data
If data is needed immediately on startup, load during bootstrap:

```typescript
// lib/hooks/use-app-bootstrap.tsx
async function bootstrap() {
  // Load critical data early
  const authToken = await SecureStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  // Initialize with this data...
}
```

### For Optional/Cached Data
Load in component `useEffect` - UI shows defaults while loading:

```typescript
const [data, setData] = useState(DEFAULT_VALUE);

useEffect(() => {
  SecureStorage.getJSON('key').then(loaded => {
    if (loaded) setData(loaded);
  });
}, []);
```

## Troubleshooting

### Data not persisting

1. Check if `SecureStorage.setJSON()` is being called
2. Verify storage key is correct (`STORAGE_KEYS`)
3. Check browser console (web) or Xcode logs (iOS)
4. Make sure to `await` the operation

### Getting `null` unexpectedly

1. Key might not exist yet (normal - initialize with default)
2. Data might be corrupted (usually can't happen, but handle gracefully)
3. Platform storage might be unavailable (rare)

Solution: Always provide defaults:
```typescript
const data = await SecureStorage.getJSON(STORAGE_KEYS.KEY) || DEFAULT_VALUE;
```

### Errors on React Native

1. Make sure you're using `STORAGE_KEYS` (no hardcoded strings)
2. Import from `@/lib/storage` (not from other modules)
3. Check that `expo-secure-store` and `@react-native-async-storage/async-storage` are installed

## Need Help?

- See [SECURE_STORAGE.md](./SECURE_STORAGE.md) for full API reference
- Check `contexts/AppParamsContext.tsx` for a complete working example
- Review `lib/storage/SecureStorage.ts` for implementation details
