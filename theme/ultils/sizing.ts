import { getScale } from "@/hooks/ui/useScale";

// Static scale for backward compatibility (computed once at load)
export const scale = getScale();

/* ───────────────────────────────
   Font Sizes (base values)
──────────────────────────────── */
const fontBase = {
  caption: 10,
  subtitle: 14,
  para: 18,
  body1: 22,
  body2: 24,
  body3: 26,
  heading1: 36,
  heading2: 32,
  heading3: 28,
  title: 58,
};

/**
 * Font scale curves per token
 * Values in [0..1]. 1 = scale fully with global scale, 0 = fixed size.
 * Larger text tends to wrap earlier, so scale it a bit less by default.
 */
export const fontCurves: Record<keyof typeof fontBase, number> = {
  caption: 1.0,
  subtitle: 1.0,
  para: 0.95,
  body1: 0.92,
  body2: 0.9,
  body3: 0.88,
  heading1: 0.85,
  heading2: 0.88,
  heading3: 0.9,
  title: 0.85,
};

/**
 * Fine nudges (in px/points) applied AFTER scaling.
 * Use small negative values (-1, -2) to tuck sizes that tend to wrap.
 * You can mutate these at runtime if needed (e.g., from a settings screen).
 */
export const fontNudges: Partial<Record<keyof typeof fontBase, number>> = {
  // Example tweaks (leave empty by default):
  // body1: -1,
  // body2: -2,
};

/* ───────────────────────────────
   Spacing (base values)
──────────────────────────────── */
const spaceBase = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 20,
  lg: 28,
  xl: 32,
  xxl: 36,
};

/* ───────────────────────────────
   Sizing (base values; multiples of 8)
   Used for icons, avatars, spinners, and other component dimensions
──────────────────────────────── */
const sizeBase = {
  xxs: 4,
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
};

/* ───────────────────────────────
   Line Height (base values)
   Paired with corresponding font sizes for consistent typography
──────────────────────────────── */
const lineHeightBase = {
  caption: 12, // for $caption (10px)
  subtitle: 20, // for $subtitle (14px)
  para: 26, // for $para (18px)
  body1: 24, // for $body1 (22px)
  body2: 28, // for $body2 (24px)
  body3: 32, // for $body3 (26px)
  heading3: 32, // for $heading3 (28px)
  heading2: 36, // for $heading2 (32px)
  heading1: 40, // for $heading1 (36px)
  title: 56, // for $title (58px)
};

/* ───────────────────────────────
   Button Sizes (base values)
──────────────────────────────── */
const buttonBase = {
  sm: { height: 32, paddingHorizontal: 10 },
  md: { height: 44, paddingHorizontal: 14 },
  lg: { height: 56, paddingHorizontal: 18 },
};

/* ───────────────────────────────
   Modal Sizes (base values)
──────────────────────────────── */
const modalBase = {
  sm: { width: 300, height: 250 },
  md: { width: 480, height: 400 },
  lg: { width: 640, height: 520 },
};

/* ───────────────────────────────
   Border Widths
──────────────────────────────── */
export const border = {
  thin: 1,
  regular: 2,
  thick: 3,
};

/* ───────────────────────────────
   Radius
──────────────────────────────── */
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  round: 9999,
};

/* ───────────────────────────────
   Function to build sizing object from scale
   This allows dynamic recalculation when scale changes
──────────────────────────────── */
export function buildSizing(scaleValue: number) {
  // Helper that applies a non-linear curve and optional nudge per token
  const sized = (base: number, key: keyof typeof fontBase) => {
    /* eslint-disable-next-line security/detect-object-injection */
    const curve = fontCurves[key] ?? 1;
    const effectiveScale = 1 + (scaleValue - 1) * curve;
    /* eslint-disable-next-line security/detect-object-injection */
    const nudge = fontNudges[key] ?? 0;
    return Math.round(base * effectiveScale + nudge);
  };

  const font = {
    caption: sized(fontBase.caption, "caption"),
    subtitle: sized(fontBase.subtitle, "subtitle"),
    para: sized(fontBase.para, "para"),
    body1: sized(fontBase.body1, "body1"),
    body2: sized(fontBase.body2, "body2"),
    body3: sized(fontBase.body3, "body3"),
    heading1: sized(fontBase.heading1, "heading1"),
    heading2: sized(fontBase.heading2, "heading2"),
    heading3: sized(fontBase.heading3, "heading3"),
    title: sized(fontBase.title, "title"),
  };

  const space = {
    xxs: spaceBase.xxs * scaleValue,
    xs: spaceBase.xs * scaleValue,
    sm: spaceBase.sm * scaleValue,
    md: spaceBase.md * scaleValue,
    lg: spaceBase.lg * scaleValue,
    xl: spaceBase.xl * scaleValue,
    xxl: spaceBase.xxl * scaleValue,
  };

  const size = {
    xxs: sizeBase.xxs * scaleValue,
    xs: sizeBase.xs * scaleValue,
    sm: sizeBase.sm * scaleValue,
    md: sizeBase.md * scaleValue,
    lg: sizeBase.lg * scaleValue,
    xl: sizeBase.xl * scaleValue,
    xxl: sizeBase.xxl * scaleValue,
  };

  const lineHeight = {
    caption: lineHeightBase.caption * 1,
    subtitle: lineHeightBase.subtitle * 1,
    para: lineHeightBase.para * 1,
    body1: lineHeightBase.body1 * 1,
    body2: lineHeightBase.body2 * 1,
    body3: lineHeightBase.body3 * 1,
    heading3: lineHeightBase.heading3 * 1,
    heading2: lineHeightBase.heading2 * 1,
    heading1: lineHeightBase.heading1 * 1,
    title: lineHeightBase.title * 1,
  };

  const button = {
    sm: {
      height: buttonBase.sm.height * scaleValue,
      paddingHorizontal: buttonBase.sm.paddingHorizontal * scaleValue,
      font: font.para,
    },
    md: {
      height: buttonBase.md.height * scaleValue,
      paddingHorizontal: buttonBase.md.paddingHorizontal * scaleValue,
      font: font.body1,
    },
    lg: {
      height: buttonBase.lg.height * scaleValue,
      paddingHorizontal: buttonBase.lg.paddingHorizontal * scaleValue,
      font: font.body2,
    },
  };

  const modal = {
    sm: {
      width: modalBase.sm.width * scaleValue,
      height: modalBase.sm.height * scaleValue,
    },
    md: {
      width: modalBase.md.width * scaleValue,
      height: modalBase.md.height * scaleValue,
    },
    lg: {
      width: modalBase.lg.width * scaleValue,
      height: modalBase.lg.height * scaleValue,
    },
  };

  return {
    scale: scaleValue,
    font,
    space,
    size,
    lineHeight,
    button,
    modal,
    border,
    radius,
    s: (value: number) => value * scaleValue,
  };
}

/* ───────────────────────────────
   Static S object (backward compatibility)
──────────────────────────────── */
export const S = buildSizing(scale);

/* ───────────────────────────────
   Type Exports
──────────────────────────────── */
export type Sizing = ReturnType<typeof buildSizing>;
export type FontSizes = keyof typeof fontBase;
export type SpacingSizes = keyof typeof spaceBase;
export type SizeSizes = keyof typeof sizeBase;
export type LineHeightSizes = keyof typeof lineHeightBase;
export type ButtonSizes = keyof typeof buttonBase;
export type ModalSizes = keyof typeof modalBase;
export type BorderSizes = keyof typeof border;
export type RadiusSizes = keyof typeof radius;

// Legacy exports for backward compatibility
export const font = S.font;
export const space = S.space;
export const size = S.size;
export const lineHeight = S.lineHeight;
export const button = S.button;
export const modal = S.modal;
