/**
 * Utils Module
 *
 * General-purpose utilities for logging, versioning, performance, image optimization,
 * lazy loading, PII/field redaction, and web font handling.
 */

export * from "./entitlements";
export * from "./image-optimization";
export * from "./image-proxy";
export * from "./lazy-imports";
export { default as Logger, logger } from "./logger";
export * from "./redaction-manager";
export * from "./startup-time";
export * from "./version";
export * from "./web-font-loader";

