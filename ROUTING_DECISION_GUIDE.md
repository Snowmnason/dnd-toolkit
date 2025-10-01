# 🛡️ Routing Decision Tree Guide for D&D Toolkit

## 📋 Overview
This guide shows how to implement defensive routing throughout your app to handle missing data, deleted content, and broken states gracefully.

## 🎯 Core Pattern
```typescript
// Check if required data exists → Route to safety if not → Continue if valid
const checkDataExists = async () => {
  const data = await getRequiredData();
  if (!data) {
    // Route to appropriate fallback
    router.replace('/fallback-route');
    return;
  }
  // Continue with normal component logic
};
```

## 🗂️ Routing Decision Trees by Location

### 1. 🌍 World Selection (/app/select/world-selection.tsx)
**Checks:**
- User is authenticated
- User has completed profile
- Worlds database is accessible

**Routing Decisions:**
```
User not authenticated → /login/welcome
Profile incomplete → /login/complete-profile
No worlds found → Stay on page (show empty state)
Database error → /error (with retry option)
```

**Implementation Location:**
```typescript
// Add to useEffect in world-selection.tsx
useEffect(() => {
  const validateWorldAccess = async () => {
    // Check auth state
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/login/welcome');
      return;
    }
    
    // Check profile completion
    if (!user.user_metadata?.username) {
      router.replace('/login/complete-profile');
      return;
    }
    
    // Try to load worlds - if database error, show error page
    try {
      await worldsDB.getUserWorlds();
    } catch (error) {
      router.replace('/error?message=database-unavailable');
    }
  };
  
  validateWorldAccess();
}, []);
```

### 2. 🎲 Specific World (/app/select/world-detail/[worldName].tsx)
**Checks:**
- World exists in database
- User owns the world
- World data is complete

**Routing Decisions:**
```
World not found → /select/world-selection (with alert)
User doesn't own world → /select/world-selection (with permission error)
World data corrupted → /select/world-selection (with repair option)
```

**Implementation Location:**
```typescript
// Add to top of world detail component
const { worldName } = useLocalSearchParams();

useEffect(() => {
  const validateWorld = async () => {
    try {
      const world = await worldsDB.getWorld(worldName);
      
      if (!world) {
        Alert.alert(
          'World Not Found',
          'This world may have been deleted or moved.',
          [{ text: 'OK', onPress: () => router.replace('/select/world-selection') }]
        );
        return;
      }
      
      // Check ownership
      const { data: { user } } = await supabase.auth.getUser();
      if (world.user_id !== user?.id) {
        Alert.alert(
          'Access Denied',
          'You don\'t have permission to view this world.',
          [{ text: 'OK', onPress: () => router.replace('/select/world-selection') }]
        );
        return;
      }
      
      // Check data integrity
      if (!world.name || !world.id) {
        Alert.alert(
          'World Data Error',
          'This world appears to be corrupted. Would you like to repair it?',
          [
            { text: 'Repair', onPress: () => router.push('/repair/world/' + worldName) },
            { text: 'Go Back', onPress: () => router.replace('/select/world-selection') }
          ]
        );
        return;
      }
      
    } catch (error) {
      Alert.alert(
        'Error Loading World',
        'Unable to load world data. Please try again.',
        [{ text: 'OK', onPress: () => router.replace('/select/world-selection') }]
      );
    }
  };
  
  validateWorld();
}, [worldName]);
```

### 3. 🗺️ Map Screen (/app/(tabs)/MapScreen.js)
**Checks:**
- Current world is set
- Map data exists
- User has map permissions

**Routing Decisions:**
```
No current world → /select/world-selection
Map data missing → /world-detail/[worldName] (with map creation prompt)
No map permissions → /world-detail/[worldName] (with permission request)
```

**Implementation Location:**
```typescript
// Add to MapScreen component
useEffect(() => {
  const validateMapAccess = async () => {
    // Check if current world is set (from context or params)
    const currentWorld = getCurrentWorld(); // Your world context/state
    
    if (!currentWorld) {
      Alert.alert(
        'No World Selected',
        'Please select a world to view its map.',
        [{ text: 'Select World', onPress: () => router.replace('/select/world-selection') }]
      );
      return;
    }
    
    // Check map data exists
    const mapData = await worldsDB.getWorldMap(currentWorld.id);
    if (!mapData) {
      Alert.alert(
        'Map Not Found',
        'This world doesn\'t have a map yet. Would you like to create one?',
        [
          { text: 'Create Map', onPress: () => router.push('/create/map/' + currentWorld.id) },
          { text: 'Go Back', onPress: () => router.push('/world-detail/' + currentWorld.name) }
        ]
      );
      return;
    }
  };
  
  validateMapAccess();
}, []);
```

### 4. 🏠 World Dashboard (/app/(tabs)/WorldDashboard.js)
**Checks:**
- World exists and is accessible
- Dashboard data is available
- User has dashboard permissions

**Routing Decisions:**
```
World deleted → /select/world-selection
Dashboard data corrupted → /repair/dashboard/[worldName]
Permission revoked → /select/world-selection
```

### 5. 👤 Character Sheet (/app/character/[characterId].tsx)
**Checks:**
- Character exists
- Character belongs to current world
- User owns character or has permission

**Routing Decisions:**
```
Character not found → /characters (character list)
Character from different world → /characters?world=[worldName]
No permission → /world-detail/[worldName]
```

### 6. 📝 Notes/Journal (/app/notes/[noteId].tsx)
**Checks:**
- Note exists
- Note belongs to accessible world
- Note isn't archived/deleted

**Routing Decisions:**
```
Note deleted → /notes (notes list)
Note archived → /notes/archived
World inaccessible → /select/world-selection
```

### 7. ⚙️ Settings (/app/settings.tsx)
**Checks:**
- User is authenticated
- Settings data is accessible

**Routing Decisions:**
```
User not authenticated → /login/welcome
Settings corrupted → /settings/repair
Database error → /error?context=settings
```

## 🔧 Helper Functions to Create

### Generic Validation Helper
```typescript
// lib/routing-helpers.ts
export const validateAndRoute = async (
  checks: Array<{ condition: () => Promise<boolean>, fallback: string, message?: string }>,
  router: any
) => {
  for (const check of checks) {
    const isValid = await check.condition();
    if (!isValid) {
      if (check.message) {
        Alert.alert('Error', check.message, [
          { text: 'OK', onPress: () => router.replace(check.fallback) }
        ]);
      } else {
        router.replace(check.fallback);
      }
      return false;
    }
  }
  return true;
};
```

### World Validation Helper
```typescript
// lib/world-validation.ts
export const validateWorldAccess = async (worldName: string, userId: string) => {
  const world = await worldsDB.getWorld(worldName);
  
  return {
    exists: !!world,
    hasAccess: world?.user_id === userId,
    isComplete: !!(world?.name && world?.id),
    world
  };
};
```

## 📍 Where to Implement

### High Priority (User frequently bookmarks/shares):
1. ✅ World detail pages
2. ✅ Character sheets  
3. ✅ Map screens
4. ✅ Note/journal entries

### Medium Priority (Internal navigation):
1. ✅ Dashboard screens
2. ✅ Settings pages
3. ✅ Creation wizards

### Low Priority (Rarely accessed directly):
1. ✅ Modal/popup content
2. ✅ Temporary views

## 🎯 Best Practices

1. **Always validate on mount** - Don't assume data exists
2. **Provide helpful error messages** - Tell users what went wrong
3. **Offer clear next steps** - "Create new" or "Go back" options
4. **Log errors for debugging** - Help yourself fix issues
5. **Test with broken data** - Intentionally break things to test routing
6. **Use loading states** - Show spinners while validating
7. **Graceful degradation** - Partial functionality when possible

## 🔄 Common Patterns

### Pattern 1: Existence Check
```typescript
const data = await getData(id);
if (!data) {
  router.replace('/fallback');
  return;
}
```

### Pattern 2: Permission Check
```typescript
if (!hasPermission(user, resource)) {
  Alert.alert('Access Denied', message);
  router.replace('/safe-location');
  return;
}
```

### Pattern 3: Data Integrity Check
```typescript
if (!isDataValid(data)) {
  Alert.alert('Data Corrupted', 'Would you like to repair?', [
    { text: 'Repair', onPress: () => router.push('/repair') },
    { text: 'Cancel', onPress: () => router.replace('/fallback') }
  ]);
  return;
}
```

This routing decision system will make your app bulletproof against broken states! 🛡️