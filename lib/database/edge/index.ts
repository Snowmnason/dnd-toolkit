/**
 * Edge Function Module - Barrel Export
 *
 * Central location for edge function (stored procedure / RPC) abstractions.
 * Supports multiple backend implementations: Supabase RPC, Cloud Functions, etc.
 *
 * Architecture:
 * - registry.ts — defines EdgeFunctionImplementation and registry that maps names to handlers
 * - supabase-rpc-adapter.ts — Supabase RPC adapter with type-safe inputs/outputs for all 5 stored procedures
 */

// Core registry
export {
  clearEdgeFunctionRegistry,
  executeEdgeFunction,
  getEdgeFunction,
  getRegisteredEdgeFunctions,
  isEdgeFunctionRegistered,
  registerEdgeFunction,
  type EdgeFunctionImplementation
} from "./registry";

