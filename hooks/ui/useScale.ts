// theme/hooks/useScale.ts
import { useEffect, useState } from 'react'
import { Dimensions, Platform } from 'react-native'

// Utility: clamp a number in range
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(n, max))

// Guideline baseline for scaling
export const BASELINE_WIDTH = 375

export type ScaleOptions = {
  useWidth?: boolean
  width?: number
  baseline?: number
  min?: number
  max?: number
  mobileBase?: number
  webBase?: number
}

export function getWidthFactor(
  w: number,
  baseline: number = BASELINE_WIDTH,
  min = 0.85,
  max = 1.2,
) {
  const factor = w / baseline
  return clamp(factor, min, max)
}

export function getWebScale(opts: ScaleOptions = {}) {
  const {
    useWidth = true,
    width: w = Dimensions.get('window').width,
    baseline = 1280,
    min = 0.95,
    max = 1.6,
    webBase = 1,
  } = opts
  const factor = useWidth ? getWidthFactor(w, baseline, min, max) : 1
  return webBase * factor
}

export function getMobileScale(opts: ScaleOptions = {}) {
  const {
    useWidth = false,
    width: w = Dimensions.get('window').width,
    baseline = BASELINE_WIDTH,
    min = 0.85,
    max = 1.2,
    mobileBase = 0.85,
  } = opts
  const factor = useWidth ? getWidthFactor(w, baseline, min, max) : 1
  return mobileBase * factor
}

/**
 * Core function: returns scale value based on current platform and options.
 */
export function getScale(opts: ScaleOptions = {}) {
  return Platform.OS === 'web' ? getWebScale(opts) : getMobileScale(opts)
}

/**
 * React hook that listens for screen size changes and updates scale in real time.
 */
export function useScale(opts: ScaleOptions = {}) {
  const [scale, setScale] = useState(() => getScale(opts))

  useEffect(() => {
    const handler = ({ window }: any) => {
      setScale(getScale({ ...opts, width: window.width }))
    }
    const sub = Dimensions.addEventListener('change', handler)
    return () => sub?.remove?.()
  }, [opts])

  return scale
}
