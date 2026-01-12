import { Platform } from 'react-native'

/**
 * Returns the time (in milliseconds) from app launch to bridge initialization.
 * Only available on native builds (Android/iOS with Hermes).
 * Returns 0 on web and desktop (not applicable).
 *
 * Use this to measure startup performance before/after Hermes verification:
 *
 * @example
 * import { nativeStartTime } from '@/lib/utils/startup-time'
 *
 * const startupMs = nativeStartTime()
 * console.log(`App started in ${startupMs}ms`)
 */
export function nativeStartTime(): number {
  // Only available on native platforms (ios/android)
  // Returns 0 on web and desktop (not applicable)
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return 0
  }

  // On native (Android/iOS), the start time is set by the native bridge
  // and stored globally. This is a safe fallback.
  try {
    const global_ = global as any
    return global_.__startupTime || 0
  } catch {
    return 0
  }
}
