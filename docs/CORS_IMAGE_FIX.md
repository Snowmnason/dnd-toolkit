# CORS Image Loading Fix

## Problem
External image URLs (like from `media.wizards.com`) trigger CORS errors in the browser because they don't include `Access-Control-Allow-Origin` headers.

## Solution
The app has been updated to avoid loading external images directly:

### Changes Made:
1. **create-world.tsx**: Replaced external URLs with local placeholders
2. **use-world-creation.tsx**: Changed default map image to empty string (maps can be added later)
3. **image-proxy.ts**: Created utility for future CORS handling

### For Production:
Choose one of these approaches:

#### Option 1: Use Local Images (Recommended)
1. Download map images and save to `assets/images/`
2. Update `defaultMapImages` in `create-world.tsx` to use require() paths
3. Example:
   ```tsx
   const defaultMapImages = [
     require('@/assets/images/sword-coast-map.jpg'),
     require('@/assets/images/forgotten-realms-map.jpg'),
   ]
   ```

#### Option 2: Backend Image Proxy
Create a backend endpoint that fetches and serves images with proper CORS headers:
```tsx
const defaultMapImages = [
  '/api/proxy-image?url=https://media.wizards.com/...',
]
```

#### Option 3: Request CORS Headers
Contact the original server (Wizards of the Coast) to add CORS headers to their responses.

## Current State
- No external URLs are loaded on dev
- Map images default to empty string
- Users can upload custom maps via the "Import Image" button
