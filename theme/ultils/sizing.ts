import { getScale } from '../../hooks/useScale'

// Static scale for backward compatibility (computed once at load)
export const scale = getScale()

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
}

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
}

/* ───────────────────────────────
   Button Sizes (base values)
──────────────────────────────── */
const buttonBase = {
  sm: { height: 32, paddingHorizontal: 10 },
  md: { height: 44, paddingHorizontal: 14 },
  lg: { height: 56, paddingHorizontal: 18 },
}

/* ───────────────────────────────
   Modal Sizes (base values)
──────────────────────────────── */
const modalBase = {
  sm: { width: 300, height: 250 },
  md: { width: 480, height: 400 },
  lg: { width: 640, height: 520 },
}

/* ───────────────────────────────
   Border Widths
──────────────────────────────── */
export const border = {
  thin: 1,
  regular: 2,
  thick: 3,
}

/* ───────────────────────────────
   Radius
──────────────────────────────── */
export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  round: 9999,
}

/* ───────────────────────────────
   Function to build sizing object from scale
   This allows dynamic recalculation when scale changes
──────────────────────────────── */
export function buildSizing(scaleValue: number) {
  const font = {
    caption: fontBase.caption * scaleValue,
    subtitle: fontBase.subtitle * scaleValue,
    para: fontBase.para * scaleValue,
    body1: fontBase.body1 * scaleValue,
    body2: fontBase.body2 * scaleValue,
    body3: fontBase.body3 * scaleValue,
    heading1: fontBase.heading1 * scaleValue,
    heading2: fontBase.heading2 * scaleValue,
    heading3: fontBase.heading3 * scaleValue,
    title: fontBase.title * scaleValue,
  }

  const space = {
    xxs: spaceBase.xxs * scaleValue,
    xs: spaceBase.xs * scaleValue,
    sm: spaceBase.sm * scaleValue,
    md: spaceBase.md * scaleValue,
    lg: spaceBase.lg * scaleValue,
    xl: spaceBase.xl * scaleValue,
    xxl: spaceBase.xxl * scaleValue,
  }

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
  }

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
  }

  return {
    scale: scaleValue,
    font,
    space,
    button,
    modal,
    border,
    radius,
    s: (value: number) => value * scaleValue,
  }
}

/* ───────────────────────────────
   Static S object (backward compatibility)
──────────────────────────────── */
export const S = buildSizing(scale)

/* ───────────────────────────────
   Type Exports
──────────────────────────────── */
export type Sizing = ReturnType<typeof buildSizing>
export type FontSizes = keyof typeof fontBase
export type SpacingSizes = keyof typeof spaceBase
export type ButtonSizes = keyof typeof buttonBase
export type ModalSizes = keyof typeof modalBase
export type BorderSizes = keyof typeof border
export type RadiusSizes = keyof typeof radius

// Legacy exports for backward compatibility
export const font = S.font
export const space = S.space
export const button = S.button
export const modal = S.modal
