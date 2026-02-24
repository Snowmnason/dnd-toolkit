/**
 * Edge Functions Module - Compatibility Shim
 *
 * Centrally re-exports edge function constants, registry, and adapters from lib/database/edge/.
 * All canonical implementations now live under lib/database/edge/.
 *
 * **Migration note:** This shim maintains backward-compatibility. New code should import
 * directly from @/lib/database/edge during incremental migration.
 */

// Re-export constants from new canonical location
export {
  EDGE_FUNCTIONS,
  getEdgeFunctionUrl,
  getHealthEndpointUrl
} from "../database/edge/constants";

// Re-export registry and adapters from new canonical location
export {
  clearEdgeFunctionRegistry,
  executeEdgeFunction,
  getEdgeFunction,
  getRegisteredEdgeFunctions,
  isEdgeFunctionRegistered,
  registerEdgeFunction,
  type EdgeFunctionImplementation
} from "../database/edge";

