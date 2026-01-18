/**
 * Logger Utility - Environment-aware logging system
 *
 * Features:
 * - Feature-flag controlled logging (debugLogs flag enables production logging)
 * - Categorized logging (info, warn, error, debug)
 * - Category-based filtering for focused debugging
 * - Automatic production log stripping preparation
 * - Consistent formatting with emojis for easy scanning
 * - Module/context tagging for better debugging
 */

import { getAppConfig } from "@/lib/config/loader";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogCategory =
  | "auth" // Authentication and session management
  | "navigation" // Navigation and routing
  | "api" // API requests and network calls
  | "network" // Network detection and status
  | "performance" // Performance monitoring and timing
  | "storage" // Data storage and caching
  | "ui" // UI components and rendering
  | "analytics" // Analytics and tracking
  | "security" // Security-related operations
  | "bootstrap" // App initialization and bootstrap
  | "error" // Error handling and reporting
  | "other"; // Catch-all for miscellaneous logs

interface LoggerConfig {
  enabledLevels: LogLevel[];
  enabledCategories: LogCategory[];
  showTimestamp: boolean;
  showContext: boolean;
}

/**
 * Category-specific logger for cleaner API
 */
class CategoryLogger {
  constructor(
    private logger: Logger,
    private category: LogCategory
  ) {}

  debug(context: string | undefined, ...args: any[]): void;
  debug(...args: any[]): void;
  debug(...args: any[]): void {
    this.logger.debug(this.category, ...Array.from(arguments));
  }

  info(context: string | undefined, ...args: any[]): void;
  info(...args: any[]): void;
  info(...args: any[]): void {
    this.logger.info(this.category, ...Array.from(arguments));
  }

  warn(context: string | undefined, ...args: any[]): void;
  warn(...args: any[]): void;
  warn(...args: any[]): void {
    this.logger.warn(this.category, ...Array.from(arguments));
  }

  error(context: string | undefined, ...args: any[]): void;
  error(...args: any[]): void;
  error(...args: any[]): void {
    this.logger.error(this.category, ...Array.from(arguments));
  }

  success(context: string | undefined, ...args: any[]): void;
  success(...args: any[]): void;
  success(...args: any[]): void {
    this.logger.success(this.category, ...Array.from(arguments));
  }

  group(label: string, collapsed: boolean = false): void {
    this.logger.group(label, collapsed, this.category);
  }

  groupEnd(): void {
    this.logger.groupEnd(this.category);
  }

  table(data: any): void {
    this.logger.table(data, this.category);
  }
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Get app config to check debugLogs feature flag
    const appConfig = getAppConfig();
    const debugLogsEnabled = appConfig.featureFlags.debugLogs?.enabled ?? false;

    // Configure based on feature flag - allows production logging when enabled
    this.config = {
      enabledLevels: debugLogsEnabled
        ? ["debug", "info", "warn", "error"] // All levels when debug logging enabled
        : ["error"], // Production: only errors
      enabledCategories: this.getEnabledCategories(appConfig),
      showTimestamp: debugLogsEnabled,
      showContext: debugLogsEnabled,
    };
  }

  /**
   * Determine which categories are enabled based on config
   */
  private getEnabledCategories(appConfig: any): LogCategory[] {
    const debugLogsEnabled = appConfig.featureFlags.debugLogs?.enabled ?? false;

    // In production, only enable critical categories
    if (!debugLogsEnabled) {
      return ["error", "security"];
    }

    // In development/debug mode, check for category-specific flags
    // Default to enabling all categories if no specific config
    const categoryConfig = appConfig.featureFlags.loggerCategories;
    if (!categoryConfig || !categoryConfig.categories) {
      return [
        "auth",
        "navigation",
        "api",
        "network",
        "performance",
        "storage",
        "ui",
        "analytics",
        "security",
        "bootstrap",
        "error",
        "other",
      ];
    }

    // Build enabled categories from flags
    const enabled: LogCategory[] = [];
    const categories = categoryConfig.categories;
    if (categories.auth !== false) enabled.push("auth");
    if (categories.navigation !== false) enabled.push("navigation");
    if (categories.api !== false) enabled.push("api");
    if (categories.network !== false) enabled.push("network");
    if (categories.performance !== false) enabled.push("performance");
    if (categories.storage !== false) enabled.push("storage");
    if (categories.ui !== false) enabled.push("ui");
    if (categories.analytics !== false) enabled.push("analytics");
    if (categories.security !== false) enabled.push("security");
    if (categories.bootstrap !== false) enabled.push("bootstrap");
    if (categories.error !== false) enabled.push("error");
    if (categories.other !== false) enabled.push("other");

    return enabled;
  }

  /**
   * Check if a log level is enabled for a given category
   */
  private isEnabled(level: LogLevel, category?: LogCategory): boolean {
    if (!this.config.enabledLevels.includes(level)) return false;
    if (category && !this.config.enabledCategories.includes(category))
      return false;
    return true;
  }

  /**
   * Check if a string is a valid LogCategory
   */
  private isValidCategory(str: string): str is LogCategory {
    const validCategories: LogCategory[] = [
      "auth",
      "navigation",
      "api",
      "network",
      "performance",
      "storage",
      "ui",
      "analytics",
      "security",
      "bootstrap",
      "error",
      "other",
    ];
    return validCategories.includes(str as LogCategory);
  }

  /**
   * Format log message with optional context and timestamp
   */
  private formatMessage(
    emoji: string,
    context: string | undefined,
    category: LogCategory | undefined,
    ...args: any[]
  ): any[] {
    const parts: any[] = [];

    if (this.config.showTimestamp) {
      const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
      parts.push(`[${timestamp}]`);
    }

    if (category && this.config.showContext) {
      parts.push(`[${category.toUpperCase()}]`);
    } else if (this.config.showContext && context) {
      parts.push(`[${context}]`);
    }

    parts.push(emoji);
    parts.push(...args);

    return parts;
  }

  /**
   * Get a category-specific logger for cleaner API
   * Usage: logger.category('auth').info('User logged in')
   */
  category(cat: LogCategory): CategoryLogger {
    return new CategoryLogger(this, cat);
  }

  /**
   * Debug level - Detailed information for debugging
   * Only shown in development
   */
  debug(
    category: LogCategory | undefined,
    context: string | undefined,
    ...args: any[]
  ): void;
  debug(context: string | undefined, ...args: any[]): void;
  debug(...args: any[]): void;
  debug(...args: any[]): void {
    // Parse arguments: category?, context?, ...message
    let category: LogCategory | undefined;
    let context: string | undefined;
    let messageArgs: any[];

    if (typeof args[0] === "string" && this.isValidCategory(args[0])) {
      category = args.shift() as LogCategory;
    }

    if (typeof args[0] === "string" && args.length > 1) {
      context = args.shift();
    }

    messageArgs = args;

    if (!this.isEnabled("debug", category)) return;

    console.log(...this.formatMessage("🔍", context, category, ...messageArgs));
  }

  /**
   * Info level - General information
   * Shown in development, hidden in production
   */
  info(
    category: LogCategory | undefined,
    context: string | undefined,
    ...args: any[]
  ): void;
  info(context: string | undefined, ...args: any[]): void;
  info(...args: any[]): void;
  info(...args: any[]): void {
    // Parse arguments: category?, context?, ...message
    let category: LogCategory | undefined;
    let context: string | undefined;
    let messageArgs: any[];

    if (typeof args[0] === "string" && this.isValidCategory(args[0])) {
      category = args.shift() as LogCategory;
    }

    if (typeof args[0] === "string" && args.length > 1) {
      context = args.shift();
    }

    messageArgs = args;

    if (!this.isEnabled("info", category)) return;

    console.log(...this.formatMessage("ℹ️", context, category, ...messageArgs));
  }

  /**
   * Warn level - Warning messages
   * Shown in development, hidden in production (unless configured)
   */
  warn(
    category: LogCategory | undefined,
    context: string | undefined,
    ...args: any[]
  ): void;
  warn(context: string | undefined, ...args: any[]): void;
  warn(...args: any[]): void;
  warn(...args: any[]): void {
    // Parse arguments: category?, context?, ...message
    let category: LogCategory | undefined;
    let context: string | undefined;
    let messageArgs: any[];

    if (typeof args[0] === "string" && this.isValidCategory(args[0])) {
      category = args.shift() as LogCategory;
    }

    if (typeof args[0] === "string" && args.length > 1) {
      context = args.shift();
    }

    messageArgs = args;

    if (!this.isEnabled("warn", category)) return;

    console.warn(
      ...this.formatMessage("⚠️", context, category, ...messageArgs)
    );
  }

  /**
   * Error level - Error messages
   * Always shown (even in production)
   */
  error(
    category: LogCategory | undefined,
    context: string | undefined,
    ...args: any[]
  ): void;
  error(context: string | undefined, ...args: any[]): void;
  error(...args: any[]): void;
  error(...args: any[]): void {
    // Parse arguments: category?, context?, ...message
    let category: LogCategory | undefined;
    let context: string | undefined;
    let messageArgs: any[];

    if (typeof args[0] === "string" && this.isValidCategory(args[0])) {
      category = args.shift() as LogCategory;
    }

    if (typeof args[0] === "string" && args.length > 1) {
      context = args.shift();
    }

    messageArgs = args;

    if (!this.isEnabled("error", category)) return;

    console.error(
      ...this.formatMessage("❌", context, category, ...messageArgs)
    );
  }

  /**
   * Success level - Success messages (uses info level)
   * Shown in development only
   */
  success(
    category: LogCategory | undefined,
    context: string | undefined,
    ...args: any[]
  ): void;
  success(context: string | undefined, ...args: any[]): void;
  success(...args: any[]): void;
  success(...args: any[]): void {
    // Parse arguments: category?, context?, ...message
    let category: LogCategory | undefined;
    let context: string | undefined;
    let messageArgs: any[];

    if (typeof args[0] === "string" && this.isValidCategory(args[0])) {
      category = args.shift() as LogCategory;
    }

    if (typeof args[0] === "string" && args.length > 1) {
      context = args.shift();
    }

    messageArgs = args;

    if (!this.isEnabled("info", category)) return;

    console.log(...this.formatMessage("✅", context, category, ...messageArgs));
  }

  /**
   * Group logging for related messages
   */
  group(
    label: string,
    collapsed: boolean = false,
    category?: LogCategory
  ): void {
    if (!this.isEnabled("info", category)) return;

    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
  }

  groupEnd(category?: LogCategory): void {
    if (!this.isEnabled("info", category)) return;
    console.groupEnd();
  }

  /**
   * Table logging for structured data
   */
  table(data: any, category?: LogCategory): void {
    if (!this.isEnabled("debug", category)) return;
    console.table(data);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
