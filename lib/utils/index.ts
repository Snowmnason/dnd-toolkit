/**
 * Utils Module
 *
 * General-purpose utilities for logging, versioning, performance, image optimization,
 * lazy loading, PII redaction, and web font handling.
 */

export * from "./entitlements";
export * from "./image-optimization";
export * from "./image-proxy";
export * from "./lazy-imports";
export { default as Logger, logger } from "./logger";
export * from "./pii-redaction";
export * from "./startup-time";
export * from "./version";
export * from "./web-font-loader";

