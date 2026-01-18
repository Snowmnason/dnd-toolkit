/**
 * Type declarations for @react-native-community/netinfo
 * Allows optional dynamic imports without TypeScript errors
 */

declare module "@react-native-community/netinfo" {
  export interface NetInfoState {
    isInternetReachable: boolean | null;
    type: string;
    details?: {
      isConnectionExpensive?: boolean;
    };
  }

  export interface NetInfoType {
    addEventListener(callback: (state: NetInfoState) => void): () => void;
    fetch?(): Promise<NetInfoState>;
  }

  const NetInfo: NetInfoType;
  export { NetInfo };
}
