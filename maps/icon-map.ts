/**
 * Icon asset map — single source of truth for all SVG icon assets.
 *
 * Maps (IconKey, IconVariant) → bundled asset number (require result).
 * Centralizes the filled/outlined toggle logic so call sites only pass a
 * key and a boolean/variant string — no need to manage two imports per icon.
 *
 * Usage:
 *   const source = getIconAsset('char', 'filled');
 *   <Image source={source} />
 *
 * Preloading:
 *   Asset.loadAsync(getAllIconAssets());
 *
 * Adding a new icon:
 *   1. Drop the SVG(s) into assets/icons/required/ (or assets/icons/required/panels/ for panel icons).
 *   2. Add the entry to ICON_ASSETS below (IconKey is automatically inferred).
 *
 * Note: `world` currently has no filled variant — getIconAsset falls back to
 * outlined automatically. The `treasure` files have a typo in their filename
 * ("teasure") — the require paths match the real filenames.
 */

export type IconVariant = 'filled' | 'outlined';

type IconEntry = {
  /** Filled variant (active / selected state). Optional — falls back to outlined. */
  filled?: number;
  /** Outlined variant (inactive / default state). Always required. */
  outlined: number;
};

const ICON_ASSETS = {
  char: {
    filled: require('../assets/icons/required/panels/char_filled.svg'),
    outlined: require('../assets/icons/required/panels/char_outlined.svg'),
  },
  combat: {
    filled: require('../assets/icons/required/panels/combat_filled.svg'),
    outlined: require('../assets/icons/required/panels/combat_outlined.svg'),
  },
  story: {
    filled: require('../assets/icons/required/panels/story_filled.svg'),
    outlined: require('../assets/icons/required/panels/story_outlined.svg'),
  },
  // Note: SVG filenames have a typo ("teasure"). Require paths match real filenames.
  treasure: {
    filled: require('../assets/icons/required/panels/treasure_filled.svg'),
    outlined: require('../assets/icons/required/panels/treasure_outlined.svg'),
  },
  // Note: No filled variant exists yet — filled calls fall back to outlined.
  world: {
    outlined: require('../assets/icons/required/panels/world_outlined.svg'),
    filled: require('../assets/icons/required/panels/world_outlined.svg'),
  },
  settings: {
    filled: require('../assets/icons/required/settings_filled.svg'),
    outlined: require('../assets/icons/required/settings_outlined.svg'),
  },
};

export type IconKey = keyof typeof ICON_ASSETS;

/**
 * Resolve the asset source for the given icon key and variant.
 * Falls back to outlined if the requested filled variant is not available.
 */
export function getIconAsset(key: IconKey, variant: IconVariant): number {
  // eslint-disable-next-line security/detect-object-injection
  const entry: IconEntry = ICON_ASSETS[key];
  if (variant === 'filled' && entry.filled !== undefined) {
    return entry.filled;
  }
  return entry.outlined;
}

/**
 * Returns every registered icon asset as a flat array.
 * Pass this to Asset.loadAsync() during the bootstrap preload phase.
 */
export function getAllIconAssets(): number[] {
  return Object.values(ICON_ASSETS).flatMap((entry) =>
    ([entry.filled, entry.outlined] as (number | undefined)[]).filter(
      (v): v is number => v !== undefined,
    ),
  );
}
