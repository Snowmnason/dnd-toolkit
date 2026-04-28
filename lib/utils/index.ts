/**
 * Utils Module
 *
 * Primary export: logger. Other utilities (image-optimization, image-proxy,
 * lazy-imports, startup-time, version) are imported directly from their source files.
 */

export { default as Logger, logger } from "./logger";
export type { CategoryLogger, LogCategory, LogLevel, LogMetadata, LogSchema, PerfTimer } from "./logger";


