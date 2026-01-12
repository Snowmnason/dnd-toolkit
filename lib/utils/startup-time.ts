import { Platform } from 'react-native'

/**
 * Returns the time (in milliseconds) from app launch to bridge initialization.
 * Only available on native builds (Android/iOS with Hermes).
 * Returns 0 on web and desktop (not applicable).
 *
 * SECURITY NOTE: This global property is set by trusted native code only.
 * The __startupTime global is initialized by the React Native bridge during
 * app startup and should not be modified by JavaScript code. This function
 * includes validation to prevent exploitation from malicious scripts.
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
  // and stored globally. Validate the value to prevent exploitation.
  try {
    const global_ = global as any
    const startupTime = global_.__startupTime

    // Validate that the value is a reasonable number
    if (typeof startupTime !== 'number' || isNaN(startupTime)) {
      return 0
    }

    // Validate reasonable range: startup time should be positive and not exceed 30 seconds
    // (extremely long startup times indicate invalid data)
    if (startupTime < 0 || startupTime > 30000) {
      return 0
    }

    return startupTime
  } catch {
    return 0
  }
}
