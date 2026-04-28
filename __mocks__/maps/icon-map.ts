/**
 * Mock for maps/icon-map.ts
 *
 * In test environments, we can't require SVG files directly.
 * This mock provides string identifiers that serve as asset placeholders.
 */

export type IconVariant = 'filled' | 'outlined';

export type IconKey = 'char' | 'combat' | 'story' | 'treasure' | 'world' | 'settings';

// Mock asset identifiers (strings instead of require results)
const ICON_ASSETS = {
  char: {
    filled: 'icon-char-filled',
    outlined: 'icon-char-outlined',
  },
  combat: {
    filled: 'icon-combat-filled',
    outlined: 'icon-combat-outlined',
  },
  story: {
    filled: 'icon-story-filled',
    outlined: 'icon-story-outlined',
  },
  treasure: {
    filled: 'icon-treasure-filled',
    outlined: 'icon-treasure-outlined',
  },
  world: {
    outlined: 'icon-world-outlined',
    filled: 'icon-world-outlined',
  },
  settings: {
    filled: 'icon-settings-filled',
    outlined: 'icon-settings-outlined',
  },
};

/**
 * Resolve the asset source for the given icon key and variant.
 * Falls back to outlined if the requested filled variant is not available.
 */
export function getIconAsset(key: IconKey, variant: IconVariant): string {
  // eslint-disable-next-line security/detect-object-injection
  const entry = ICON_ASSETS[key];
  if (variant === 'filled' && entry.filled !== undefined) {
    return entry.filled;
  }
  return entry.outlined;
}

/**
 * Returns every registered icon asset as a flat array.
 * In tests, returns string identifiers.
 */
export function getAllIconAssets(): string[] {
  return Object.values(ICON_ASSETS).flatMap((entry) =>
    ([entry.filled, entry.outlined] as (string | undefined)[]).filter(
      (v): v is string => v !== undefined,
    ),
  );
}
