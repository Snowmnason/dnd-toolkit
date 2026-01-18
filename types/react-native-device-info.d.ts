/**
 * Type declarations for react-native-device-info
 * Allows optional dynamic imports without TypeScript errors
 */

declare module "react-native-device-info" {
  export const getBatteryLevel: () => Promise<number>;
  export const isCharging: () => Promise<boolean>;
}
