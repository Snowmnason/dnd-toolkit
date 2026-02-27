/**
 * Utils Module
 *
 * General-purpose utilities for logging, versioning, performance, image optimization,
 * lazy loading, PII/field redaction, web font handling, and error code management.
 */

export * from "./image-optimization";
export * from "./image-proxy";
export * from "./lazy-imports";
export { default as Logger, logger } from "./logger";

export * from "./startup-time";
export * from "./version";
export * from "./web-font-loader";


