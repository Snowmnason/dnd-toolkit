export {
    composeNetworkContext, deriveConnectionType
} from "./helpers";
export type { ConnectionType, NetworkContext } from "./helpers";

export {
    ConnectionQuality,
    NetworkDetection, qualityToNetworkState
} from "./network-detection";
export type { NetworkStatus, NetworkStatusCallback } from "./network-detection";

export { NetworkStateManager, VALID_TRANSITIONS } from "./state-machine";
export type {
    NetworkState,
    SpecificTransitionHook,
    TransitionHook
} from "./state-machine";

