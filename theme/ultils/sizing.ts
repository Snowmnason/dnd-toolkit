import { Dimensions, Platform } from 'react-native'

/* ───────────────────────────────
   Responsive Scale Logic
   (expandable in the future)
──────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { width } = Dimensions.get('window')

// screenSize & x can later reflect true responsiveness
const screenSize = 1 // width / 375 can be used later
const x = 1

// Basic platform check
const isWeb = Platform.OS === 'web'

// Scale formula (ready for future expansion)
export const scale = isWeb
  ? 1 * (screenSize * x)
  : 0.75 * (screenSize * x)

/* ───────────────────────────────
   Font Sizes
──────────────────────────────── */
const fontBase = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  title: 32,
}

export const font = {
  xs: fontBase.xs * scale,
  sm: fontBase.sm * scale,
  md: fontBase.md * scale,
  lg: fontBase.lg * scale,
  xl: fontBase.xl * scale,
  title: fontBase.title * scale,
}

/* ───────────────────────────────
   Spacing (padding, margin, gaps)
──────────────────────────────── */
const spaceBase = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 32,
}

export const space = {
  xs: spaceBase.xs * scale,
  sm: spaceBase.sm * scale,
  md: spaceBase.md * scale,
  lg: spaceBase.lg * scale,
  xl: spaceBase.xl * scale,
  xxl: spaceBase.xxl * scale,
}

/* ───────────────────────────────
   Button Sizes
──────────────────────────────── */
const buttonBase = {
  sm: { height: 32, paddingHorizontal: 10, font: font.sm },
  md: { height: 44, paddingHorizontal: 14, font: font.md },
  lg: { height: 56, paddingHorizontal: 18, font: font.lg },
}

export const button = {
  sm: {
    height: buttonBase.sm.height * scale,
    paddingHorizontal: buttonBase.sm.paddingHorizontal * scale,
    font: font.sm,
  },
  md: {
    height: buttonBase.md.height * scale,
    paddingHorizontal: buttonBase.md.paddingHorizontal * scale,
    font: font.md,
  },
  lg: {
    height: buttonBase.lg.height * scale,
    paddingHorizontal: buttonBase.lg.paddingHorizontal * scale,
    font: font.lg,
  },
}

/* ───────────────────────────────
   Modal Sizes (legacy compatible)
──────────────────────────────── */
const modalBase = {
  sm: { width: 300, height: 250 },
  md: { width: 480, height: 400 },
  lg: { width: 640, height: 520 },
}

export const modal = {
  sm: {
    width: modalBase.sm.width * scale,
    height: modalBase.sm.height * scale,
  },
  md: {
    width: modalBase.md.width * scale,
    height: modalBase.md.height * scale,
  },
  lg: {
    width: modalBase.lg.width * scale,
    height: modalBase.lg.height * scale,
  },
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
   Unified Sizing Object
   (ready for tokens merge)
──────────────────────────────── */
export const S = {
  scale,
  font,
  space,
  button,
  modal,
  border,
  radius,
}

/* ───────────────────────────────
   Type Exports
──────────────────────────────── */
export type Sizing = typeof S
export type FontSizes = keyof typeof font
export type SpacingSizes = keyof typeof space
export type ButtonSizes = keyof typeof button
export type ModalSizes = keyof typeof modal
export type BorderSizes = keyof typeof border
export type RadiusSizes = keyof typeof radius
