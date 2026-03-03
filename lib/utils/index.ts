/**
 * Utils Module
 *
 * General-purpose utilities for logging, versioning, performance, image optimization,
 * lazy loading, PII/field redaction, web font handling, and error code management.
 */

export * from "./images/image-optimization";
export * from "./images/image-proxy";
export { default as Logger, logger } from "./logger";
export type { CategoryLogger, LogCategory, LogLevel, LogMetadata, LogSchema, PerfTimer } from "./logger";
export * from "./performance/lazy-imports";

export * from "./performance/startup-time";
export * from "./version";


