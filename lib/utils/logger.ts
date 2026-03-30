/**
 * Logger Utility - Category-driven, colorized, human-readable logging
 *
 * Features:
 * - Category-chaining API: logger.category('api').info(...)
 * - Color-coded levels: info (default), warn (yellow), error (red), debug (magenta), analytics (blue), perf (green)
 * - Human-first console output (no JSON blobs)
 * - Optional enrichment with AppError/ERROR_CODES metadata
 * - Automatic PII redaction for sensitive keys
 * - Context stack: Auto-inject userId, worldId, requestId into all logs
 * - Batch event logger: Suppress duplicate logs over time window
 * - Performance timing: Measure and log operation duration
 * - Structured metadata: Optional schema registry for validation
 * - 100% backwards-compatible with existing callsites
 * - Feature-flag controlled logging (debugLogs flag)
 */

import { getAppConfig } from '@/config';
import { RedactionManager, redactPII } from "@/pure-algo-immutables/redaction-manager";

// Lazy imports to break circular dependency
// These are required only inside functions, not at module load time
let cachedErrorCodesMetadata: any = null;
function getErrorCodesMetadata() {
  if (!cachedErrorCodesMetadata) {
    cachedErrorCodesMetadata = require("@/maps/ERROR_CODES").ERROR_CODES_METADATA;
  }
  return cachedErrorCodesMetadata;
}

function isAppError(error: any): error is any {
  // Duck-type check: if it has 'code', 'category', 'severity' properties, treat it as AppError
  return (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "category" in error &&
    "severity" in error
  );
}

// ANSI color codes (terminal colors and backgrounds)
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  orange: "\x1b[1m\x1b[38;5;214m", // Brighter bold orange (ANSI 256 color 214)
  // Background colors only (text color unchanged)
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
} as const;

type LogLevel = "debug" | "info" | "warn" | "error" | "analytics" | "perf";

type LogCategory =
  | "auth" // Authentication and session management
  | "navigation" // Navigation and routing
  | "api" // API requests and network calls
  | "network" // Network detection and status
  | "performance" // Performance monitoring and timing
  | "storage" // Data storage and caching
  | "database" // Database queries and provider init
  | "ui" // UI components and rendering
  | "analytics" // Analytics and tracking
  | "security" // Security-related operations
  | "bootstrap" // App initialization and bootstrap
  | "jobs" // Background job queue and task processing
  | "error" // Error handling and reporting
  | "offline" // Offline sync and queue handling
  | "buckets" // File/blob storage operations
  | "realtime" // Real-time subscriptions and events
  | "other" // Catch-all for miscellaneous logs
  | "feature_flags"; // Feature flag related logs

interface LoggerConfig {
  enabledLevels: LogLevel[];
  enabledCategories: LogCategory[];
  showTimestamp: boolean;
  showContext: boolean;
}

interface LogMetadata {
  [key: string]: any;
  code?: string;
  appError?: Error | any; // AppError or Error, avoid import cycle
}

/**
 * Batch event tracker (deduplicates rapid identical log lines)
 */
interface BatchTracker {
  lastMessage?: string;
  count: number;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Performance timing result object
 */
interface PerfTimer {
  end(): void;
  getElapsed(): number;
}

/**
 * Structured metadata schema for optional validation
 * Define schemas once, reference by key
 */
type LogSchema = Record<string, any>;
const LOG_SCHEMAS: Record<string, LogSchema> = {
  // Example schemas (expand as needed):
  // 'api:request': { method: string, path: string, status?: number },
  // 'storage:write': { key: string, size: number },
};

/**
 * Category-specific logger for chaining API
 * Supports both: .info(message, metadata?) and .info(message, ...args)
 */
class CategoryLogger {
  private batchTracker: BatchTracker = { count: 0 };

  constructor(
    private category: LogCategory,
    private config: LoggerConfig,
    private contextStack: Map<string, any>,
  ) {}

  debug(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "debug", this.category, message, metadata, args, this.contextStack);
  }

  info(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "info", this.category, message, metadata, args, this.contextStack);
  }

  warn(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "warn", this.category, message, metadata, args, this.contextStack);
  }

  error(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "error", this.category, message, metadata, args, this.contextStack);
  }

  analytics(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "analytics", this.category, message, metadata, args, this.contextStack);
  }

  perf(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "perf", this.category, message, metadata, args, this.contextStack);
  }

  /**
   * Batch event logger: Suppress duplicate logs within a time window
   * Useful for high-frequency state changes (network status, battery, etc.)
   * 
   * Usage:
   *   logger.category('network').batch('Network state changed', 100); // Dedupe for 100ms
   */
  batch(message: string, debounceMs: number = 100): void {
    if (this.batchTracker.lastMessage === message) {
      this.batchTracker.count++;
      return; // Suppress duplicate
    }

    // Different message or first occurrence - log it
    this.batchTracker.lastMessage = message;
    this.batchTracker.count = 1;

    logToConsole(this.config, "info", this.category, message, undefined, [], this.contextStack);

    // Register debounce timer to reset tracker
    if (this.batchTracker.timer) {
      clearTimeout(this.batchTracker.timer);
    }
    this.batchTracker.timer = setTimeout(() => {
      // Log count summary if there were duplicates
      if (this.batchTracker.count > 1) {
        logToConsole(
          this.config,
          "debug",
          this.category,
          `${message} (repeated x${this.batchTracker.count - 1} more times in ${debounceMs}ms)`,
          undefined,
          [],
          this.contextStack
        );
      }
      this.batchTracker = { count: 0 }; // Reset
    }, debounceMs);
  }
}

class Logger {
  private config: LoggerConfig;
  private contextStack = new Map<string, any>();

  constructor() {
    // Get app config to check debugLogs feature flag
    const appConfig = getAppConfig();
    const debugLogs = appConfig.featureFlags.debugLogs;
    const debugLogsEnabled = (typeof debugLogs === "object" && debugLogs !== null && debugLogs.enabled) ?? false;

    // Configure based on feature flag - allows production logging when enabled
    this.config = {
      enabledLevels: debugLogsEnabled
        ? ["debug", "info", "warn", "error", "analytics", "perf"]
        : ["error"],
      enabledCategories: this.getEnabledCategories(debugLogsEnabled),
      showTimestamp: debugLogsEnabled,
      showContext: debugLogsEnabled,
    };
  }

  /**
   * (A) Context Stack: Set application context that auto-injects into all logs
   * Usage: logger.setContext({ userId: '123', worldId: 'abc' });
   * Output: [api] [userId='123'] [worldId='abc'] Request made
   */
  setContext(context: Record<string, any>): void {
    Object.entries(context).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        this.contextStack.delete(key);
      } else {
        this.contextStack.set(key, value);
      }
    });
  }

  /**
   * Clear specific context keys or entire context stack
   */
  clearContext(keys?: string[]): void {
    if (!keys) {
      this.contextStack.clear();
    } else {
      keys.forEach(key => this.contextStack.delete(key));
    }
  }

  /**
   * Get current context
   */
  getContext(): Record<string, any> {
    return Object.fromEntries(this.contextStack);
  }

  /**
   * (C) Performance Timing: Measure operation duration and auto-log
   * Usage:
   *   const timer = logger.startTiming('api', 'Fetch worlds');
   *   const result = await worldsDB.getMyWorlds();
   *   timer.end(); // Auto-logs: Fetch worlds completed in 245ms
   */
  startTiming(category: LogCategory, label: string): PerfTimer {
    const startTime = Date.now();
    const logger = this;

    return {
      end(): void {
        const duration = Date.now() - startTime;
        logger.category(category).perf(`${label} completed in ${duration}ms`, { duration });
      },
      getElapsed(): number {
        return Date.now() - startTime;
      }
    };
  }

  /**
   * Reconfigure logger with updated feature flag state.
   * Called after server-synced feature flags are bootstrapped.
   */
  reconfigure(debugLogsEnabled: boolean): void {
    this.config = {
      enabledLevels: debugLogsEnabled
        ? ["debug", "info", "warn", "error", "analytics", "perf"]
        : ["error"],
      enabledCategories: this.getEnabledCategories(debugLogsEnabled),
      showTimestamp: debugLogsEnabled,
      showContext: debugLogsEnabled,
    };
  }

  /**
   * Determine which categories are enabled based on config
   */
  private getEnabledCategories(debugLogsEnabled: boolean): LogCategory[] {
    if (!debugLogsEnabled) {
      return ["error", "security"];
    }

    const appConfig = getAppConfig();
    const categoryConfig = appConfig.featureFlags.loggerCategories;
    if (!categoryConfig || typeof categoryConfig !== "object" || categoryConfig === null || !categoryConfig.categories) {
      return [
        "auth",
        "navigation",
        "api",
        "network",
        "feature_flags",
        "performance",
        "storage",
        "database",
        "ui",
        "analytics",
        "security",
        "bootstrap",
        "error",
        "jobs",
        "offline",
        "buckets",
        "realtime",
        "other",
      ];
    }

    // Build enabled categories from flags
    const enabled: LogCategory[] = [];
    const categories = typeof categoryConfig === "object" && categoryConfig !== null ? categoryConfig.categories : undefined;
    if (categories.auth !== false) enabled.push("auth");
    if (categories.navigation !== false) enabled.push("navigation");
    if (categories.api !== false) enabled.push("api");
    if (categories.network !== false) enabled.push("network");
    if (categories.feature_flags !== false) enabled.push("feature_flags");
    if (categories.performance !== false) enabled.push("performance");
    if (categories.storage !== false) enabled.push("storage");
    if (categories.database !== false) enabled.push("database");
    if (categories.ui !== false) enabled.push("ui");
    if (categories.analytics !== false) enabled.push("analytics");
    if (categories.security !== false) enabled.push("security");
    if (categories.bootstrap !== false) enabled.push("bootstrap");
    if (categories.error !== false) enabled.push("error");
    if (categories.jobs !== false) enabled.push("jobs");
    if (categories.offline !== false) enabled.push("offline");
    if (categories.buckets !== false) enabled.push("buckets");
    if (categories.realtime !== false) enabled.push("realtime");
    if (categories.other !== false) enabled.push("other");

    return enabled;
  }

  /**
   * Get a category-specific logger
   */
  category(cat: LogCategory): CategoryLogger {
    return new CategoryLogger(cat, this.config, this.contextStack);
  }

  /**
   * Fallback methods for legacy pattern (logger.info without category)
   * Routes to default category
   */
  info(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "info", "other", message, metadata, args, this.contextStack);
  }

  warn(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "warn", "other", message, metadata, args, this.contextStack);
  }

  error(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "error", "other", message, metadata, args, this.contextStack);
  }

  debug(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "debug", "other", message, metadata, args, this.contextStack);
  }

  analytics(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "analytics", "other", message, metadata, args, this.contextStack);
  }

  perf(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "perf", "other", message, metadata, args, this.contextStack);
  }

  success(message: string, ...args: any[]): void {
    const metadata = extractMetadata(args);
    logToConsole(this.config, "info", "other", message, metadata, args, this.contextStack);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;

/**
 * Core logging function that outputs to console
 */
function logToConsole(
  config: LoggerConfig,
  level: LogLevel,
  category: LogCategory,
  message: string,
  metadata?: LogMetadata,
  varargs?: any[],
  contextStack?: Map<string, any>,
): void {
  // Check if this log level and category are enabled
  if (!config.enabledLevels.includes(level)) return;
  if (!config.enabledCategories.includes(category)) return;

  // Extract error code & AppError if present
  let code: string | undefined;
  let appError: any;
  let restMetadata = { ...metadata };

  if (metadata?.appError) {
    appError = metadata.appError;
    delete restMetadata.appError;
    code = isAppError(appError) ? (appError.code as string) : undefined;
  }
  if (metadata?.code) {
    code = metadata.code;
    delete restMetadata.code;
  }

  // Enrich with ERROR_CODES_METADATA if code is present
  let enrichment = "";
  if (code) {
    const metadata = getErrorCodesMetadata();
    if (metadata[code as keyof typeof metadata]) {
      const meta = metadata[code as keyof typeof metadata];
      enrichment = ` code=${code} severity=${meta.severity} errorCategory=${meta.category} userMessage="${meta.userMessage || ""}"`;
    }
  }

  // Redact sensitive keys in metadata or varargs
  const redactedMetadata = redactMetadata(restMetadata);
  const redactedVarargs = varargs ? varargs.map(arg => {
    if (typeof arg === 'object' && arg !== null && !(arg instanceof Error)) {
      return RedactionManager.redactObject(arg) || arg;
    }
    // Apply string redaction to string varargs (PII like emails, tokens, etc.)
    if (typeof arg === 'string') {
      return redactPII(arg);
    }
    return arg;
  }) : [];

  // Build context tags from contextStack
  const contextTags = buildContextTags(contextStack);

  // Format key=value pairs for simple values
  const kvPairs = formatKeyValuePairs(redactedMetadata);

  // Build log line (without ANSI codes for web; browser console handles styling)
  const timestamp = config.showTimestamp
    ? new Date().toISOString().split("T")[1].split(".")[0] + " "
    : "";
  const categoryColor = getCategoryColor(category);
  const resetCode = categoryColor ? COLORS.reset : ''; // Only add reset if color was applied
  const categoryTag = config.showContext ? `${categoryColor}[${category}]${resetCode} ` : "";

  // Redact PII from message string (e.g., Error.message, user input that may contain emails/tokens)
  const redactedMessage = typeof message === 'string' ? redactPII(message) : message;
  let logLine = `${timestamp}${categoryTag}${contextTags}${redactedMessage}${enrichment}`;
  if (kvPairs) {
    logLine += ` — ${kvPairs}`;
  }

  // Use appropriate console method for level (browser console colors whole box)
  const consoleMethod = getConsoleMethod(level);
  
  // Print main line and any varargs
  if (redactedVarargs.length > 0) {
    consoleMethod(logLine, ...redactedVarargs);
  } else {
    consoleMethod(logLine);
  }

  // Print objects from metadata as indented blocks below
  for (const [key, value] of Object.entries(redactedMetadata)) {
    if (typeof value === "object" && value !== null) {
      console.log(`  ${key}:`);
      const jsonStr = JSON.stringify(value, null, 4);
      console.log(
        jsonStr
          .split("\n")
          .map((l) => "    " + l)
          .join("\n"),
      );
    }
  }

  // If appError has a stack, print it (for errors only)
  if (level === "error" && appError) {
    let stack = (appError as Error).stack;
    if (stack) {
      // Redact PII from stack traces (may contain email, tokens, file paths with sensitive info)
      stack = redactPII(stack);
      console.log(
        `  stack:\n${stack
          .split("\n")
          .map((l) => "    " + l)
          .join("\n")}`,
      );
    }
  }
}

/**
 * Build context tags string from context stack
 * Example: "[userId='123'] [worldId='abc']"
 */
function buildContextTags(contextStack?: Map<string, any>): string {
  if (!contextStack || contextStack.size === 0) {
    return "";
  }

  const tags = Array.from(contextStack.entries())
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `[${key}='${value}']`;
      }
      return `[${key}=${value}]`;
    })
    .join(" ");

  return tags ? tags + " " : "";
}

/**
 * Extract metadata from varargs:
 * - If first arg is a plain object (not an Error), treat it as metadata
 * - Otherwise, return undefined
 */
function extractMetadata(args: any[]): LogMetadata | undefined {
  if (args.length === 0) return undefined;
  
  const first = args[0];
  
  // Check if it's a plain object (not Error, not Array, etc.)
  if (
    typeof first === "object" &&
    first !== null &&
    !(first instanceof Error) &&
    !Array.isArray(first) &&
    first.constructor === Object
  ) {
    // Remove metadata from args to prevent double-logging
    // Shift out the first element so it doesn't appear in varargs
    args.shift();
    return first as LogMetadata;
  }
  
  return undefined;
}

/**
 * Get appropriate console method for log level 
 * (console.error, console.warn, console.log, etc.)
 * In browser, this colors the entire log entry background
 */
function getConsoleMethod(level: LogLevel): typeof console.log {
  switch (level) {
    case "error":
      return console.error;   // Red background
    case "warn":
      return console.warn;    // Yellow background
    case "debug":
      return console.debug;   // Gray background
    case "analytics":
    case "perf":
      return console.info;    // Blue/cyan background
    case "info":
    default:
      return console.log;     // Default (no background)
  }
}

/**
 * Detect if the current environment supports ANSI color codes
 * - Browser: window is defined → no ANSI support
 * - TTY terminal: process.stdout.isTTY is true → ANSI support
 * - Otherwise: no ANSI support
 
function supportsAnsiColors(): boolean {
  // Browser-like environments (web, RN web, Electron renderer)
  if (typeof window !== 'undefined') {
    return false;
  }
  // Terminal/TTY environments (Metro, Node terminal)
  if (typeof process !== 'undefined' && process.stdout?.isTTY === true) {
    return true;
  }
  // Default: no ANSI support (file output, log aggregators, etc.)
  return false;
}
*/
/**
 * Get fancy text color for category tags (for terminal/web console)
 */
function getCategoryColor(category: LogCategory): string {
  // Only apply ANSI colors in TTY terminals; disable in browser/web to avoid raw escape sequences
//**if (!supportsAnsiColors()) {
/*    return '';
  }**/
  switch (category) {
    case "auth":
      return COLORS.cyan;
    case "api":
      return COLORS.blue;
    case "storage":
      return COLORS.yellow;
    case "performance":
      return COLORS.green;
    case "analytics":
      return COLORS.magenta;
    case "error":
      return COLORS.red;
    case "bootstrap":
      return COLORS.orange;
    case "database":
      return COLORS.blue;
    case "network":
      return COLORS.cyan;
    case "security":
      return COLORS.red;
    case "jobs":
      return COLORS.magenta;
    case "offline":
      return COLORS.yellow;
    case "navigation":
      return COLORS.cyan;
    case "ui":
      return COLORS.magenta;
    case "buckets":
      return COLORS.green;
    case "realtime":
      return COLORS.blue;
    case "feature_flags":
      return COLORS.magenta;
    case "other":
    default:
      return COLORS.reset;
  }
}

/**
 * Format key=value pairs from metadata (simple values only)
 */
function formatKeyValuePairs(obj: Record<string, any>): string {
  return Object.entries(obj)
    .filter(([_, v]) => typeof v !== "object" || v === null)
    .map(([k, v]) => {
      if (typeof v === "string") {
        return `${k}='${v}'`;
      }
      return `${k}=${v}`;
    })
    .join(" ");
}

/**
 * Redact sensitive keys in metadata using centralized RedactionManager
 */
function redactMetadata(obj: Record<string, any>): Record<string, any> {
  // Check if redaction is disabled (e.g., in tests)
  const shouldRedact = process.env.REDACT_LOGS !== "false";
  if (!shouldRedact) return obj;

  // Use centralized RedactionManager for consistent PII redaction
  return RedactionManager.redactObject(obj) || obj;
}

// Export types for external use
export { LOG_SCHEMAS };
export type { CategoryLogger, LogCategory, LogLevel, LogMetadata, LogSchema, PerfTimer };

