/**
 * Logger Utility - Environment-aware logging system
 * 
 * Features:
 * - Environment-based log levels (development shows all, production shows errors only)
 * - Categorized logging (info, warn, error, debug)
 * - Automatic production log stripping preparation
 * - Consistent formatting with emojis for easy scanning
 * - Module/context tagging for better debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabledLevels: LogLevel[];
  showTimestamp: boolean;
  showContext: boolean;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Determine environment using new EXPO_PUBLIC_ENVIRONMENT system
    const isDevelopment = (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'development';
    
    // Configure based on environment
    this.config = {
      enabledLevels: isDevelopment 
        ? ['debug', 'info', 'warn', 'error'] 
        : ['error'], // Production: only errors
      showTimestamp: isDevelopment,
      showContext: isDevelopment,
    };
  }

  /**
   * Check if a log level is enabled
   */
  private isEnabled(level: LogLevel): boolean {
    return this.config.enabledLevels.includes(level);
  }

  /**
   * Format log message with optional context and timestamp
   */
  private formatMessage(emoji: string, context: string | undefined, ...args: any[]): any[] {
    const parts: any[] = [];

    if (this.config.showTimestamp) {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      parts.push(`[${timestamp}]`);
    }

    if (this.config.showContext && context) {
      parts.push(`[${context}]`);
    }

    parts.push(emoji);
    parts.push(...args);

    return parts;
  }

  /**
   * Debug level - Detailed information for debugging
   * Only shown in development
   */
  debug(context: string | undefined, ...args: any[]): void;
  debug(...args: any[]): void;
  debug(...args: any[]): void {
    if (!this.isEnabled('debug')) return;
    
    const context = typeof args[0] === 'string' && args.length > 1 ? args.shift() : undefined;
    console.log(...this.formatMessage('🔍', context, ...args));
  }

  /**
   * Info level - General information
   * Shown in development, hidden in production
   */
  info(context: string | undefined, ...args: any[]): void;
  info(...args: any[]): void;
  info(...args: any[]): void {
    if (!this.isEnabled('info')) return;
    
    const context = typeof args[0] === 'string' && args.length > 1 ? args.shift() : undefined;
    console.log(...this.formatMessage('ℹ️', context, ...args));
  }

  /**
   * Warn level - Warning messages
   * Shown in development, hidden in production (unless configured)
   */
  warn(context: string | undefined, ...args: any[]): void;
  warn(...args: any[]): void;
  warn(...args: any[]): void {
    if (!this.isEnabled('warn')) return;
    
    const context = typeof args[0] === 'string' && args.length > 1 ? args.shift() : undefined;
    console.warn(...this.formatMessage('⚠️', context, ...args));
  }

  /**
   * Error level - Error messages
   * Always shown (even in production)
   */
  error(context: string | undefined, ...args: any[]): void;
  error(...args: any[]): void;
  error(...args: any[]): void {
    if (!this.isEnabled('error')) return;
    
    const context = typeof args[0] === 'string' && args.length > 1 ? args.shift() : undefined;
    console.error(...this.formatMessage('❌', context, ...args));
  }

  /**
   * Success level - Success messages (uses info level)
   * Shown in development only
   */
  success(context: string | undefined, ...args: any[]): void;
  success(...args: any[]): void;
  success(...args: any[]): void {
    if (!this.isEnabled('info')) return;
    
    const context = typeof args[0] === 'string' && args.length > 1 ? args.shift() : undefined;
    console.log(...this.formatMessage('✅', context, ...args));
  }

  /**
   * Group logging for related messages
   */
  group(label: string, collapsed: boolean = false): void {
    if (!this.isEnabled('info')) return;
    
    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (!this.isEnabled('info')) return;
    console.groupEnd();
  }

  /**
   * Table logging for structured data
   */
  table(data: any): void {
    if (!this.isEnabled('debug')) return;
    console.table(data);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
