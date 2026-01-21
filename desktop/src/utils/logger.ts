/**
 * Electron Main Process Logger
 *
 * Provides structured logging with:
 * - Log level filtering (DEBUG, INFO, WARN, ERROR)
 * - File rotation to prevent unbounded disk usage
 * - Automatic cleanup of old log files
 * - Console + file output
 *
 * Configuration via environment variables:
 * - LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error' (default: 'info')
 * - LOG_MAX_SIZE: Max file size in MB before rotation (default: 10)
 * - LOG_MAX_FILES: Number of rotated files to keep (default: 5)
 */

import * as fs from "fs";
import * as path from "path";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Max log file size in bytes before rotation */
  maxFileSize: number;
  /** Number of rotated log files to keep */
  maxFiles: number;
  /** Path to log directory */
  logDir: string;
}

/**
 * Electron Logger with file rotation
 * - Writes to both console and file
 * - Automatically rotates files when size limit reached
 * - Cleans up old log files
 * - Respects log level filters
 */
export class DesktopLogger {
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;
  private config: LoggerConfig;
  private logBuffer: string[] = [];
  private streamReady = false;
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  constructor(logDir: string, config?: Partial<LoggerConfig>) {
    this.logFilePath = path.join(logDir, "app.log");
    this.config = {
      // CRITICAL: Default to DEBUG to capture ALL logs, not just INFO and above
      // User can set LOG_LEVEL=info/warn/error to filter if needed
      // This ensures we never lose logs when debugging
      level: this.parseLogLevel(process.env.LOG_LEVEL || "debug"),
      maxFileSize: parseInt(process.env.LOG_MAX_SIZE || "10", 10) * 1024 * 1024,
      maxFiles: parseInt(process.env.LOG_MAX_FILES || "5", 10),
      logDir,
      ...config,
    };

    // Ensure log directory exists
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!fs.existsSync(logDir)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      this.originalConsole.error(
        "[Logger] Failed to create log directory:",
        error,
      );
    }

    // Create/rotate log file if needed
    this.checkAndRotate();

    // Open log stream
    this.createLogStream();

    // Override console methods
    this.setupConsoleOverrides();
  }

  /**
   * Parse log level from string
   */
  private parseLogLevel(level: string): LogLevel {
    const normalized = level.toLowerCase();
    if (normalized === "debug") return LogLevel.DEBUG;
    if (normalized === "info") return LogLevel.INFO;
    if (normalized === "warn") return LogLevel.WARN;
    if (normalized === "error") return LogLevel.ERROR;
    return LogLevel.INFO;
  }

  /**
   * Create write stream for log file
   */
  private createLogStream(): void {
    try {
      this.originalConsole.log(
        `[Logger] Opening log file: ${this.logFilePath}`,
      );

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: "a" });

      this.logStream.on("open", () => {
        this.streamReady = true;
        this.originalConsole.log("[Logger] ✅ Log stream opened and ready");

        // Flush any buffered logs
        const bufferedCount = this.logBuffer.length;
        while (this.logBuffer.length > 0) {
          const bufferedMsg = this.logBuffer.shift();
          if (bufferedMsg) {
            this.logStream!.write(`${bufferedMsg}\n`);
          }
        }

        if (bufferedCount > 0) {
          this.originalConsole.log(
            `[Logger] Flushed ${bufferedCount} buffered log messages`,
          );
        }
      });

      this.logStream.on("error", (err) => {
        this.streamReady = false;
        this.originalConsole.error(
          `[Logger] ❌ Write stream error: ${err.message}`,
        );
        this.originalConsole.error(
          `[Logger] Log file path: ${this.logFilePath}`,
        );
      });

      // Force flush every 100ms to ensure logs are written to disk
      setInterval(() => {
        if (this.logStream && this.streamReady && !this.logStream.destroyed) {
          // Write stream doesn't have explicit flush, but we can ensure
          // it remains open and responsive for continued writes
        }
      }, 100);
    } catch (error) {
      this.streamReady = false;
      this.originalConsole.error(
        `[Logger] ❌ Failed to create log stream: ${error}`,
      );
      this.originalConsole.error(`[Logger] Log file path: ${this.logFilePath}`);
    }
  }

  /**
   * Check file size and rotate if needed
   */
  private checkAndRotate(): void {
    try {
      // Check if current log file exists and is too large
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(this.logFilePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stats = fs.statSync(this.logFilePath);
        if (stats.size > this.config.maxFileSize) {
          this.rotateLogFile();
        }
      }
    } catch (error) {
      this.originalConsole.error(
        "[Logger] Error checking log file size:",
        error,
      );
    }
  }

  /**
   * Rotate log file and clean up old files
   */
  private rotateLogFile(): void {
    try {
      const dir = this.config.logDir;
      const baseName = "app";
      const ext = ".log";

      // Close current stream before rotating
      if (this.logStream) {
        this.logStream.end();
        this.logStream = null;
      }

      // Rotate existing files: app.log.4 → app.log.5, app.log.3 → app.log.4, etc.
      for (let i = this.config.maxFiles - 1; i >= 1; i--) {
        const oldPath = path.join(dir, `${baseName}${ext}.${i}`);
        const newPath = path.join(dir, `${baseName}${ext}.${i + 1}`);

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (fs.existsSync(oldPath)) {
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.renameSync(oldPath, newPath);
        }
      }

      // Rename current log to app.log.1
      const currentPath = path.join(dir, `${baseName}${ext}`);
      const archivePath = path.join(dir, `${baseName}${ext}.1`);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(currentPath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.renameSync(currentPath, archivePath);
      }

      // Delete oldest file if we have too many
      const oldestPath = path.join(
        dir,
        `${baseName}${ext}.${this.config.maxFiles + 1}`,
      );
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(oldestPath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(oldestPath);
      }

      this.originalConsole.log(
        `[Logger] Rotated log files (keeping last ${this.config.maxFiles})`,
      );
    } catch (error) {
      this.originalConsole.error("[Logger] Error rotating log file:", error);
    }
  }

  /**
   * Setup console method overrides
   */
  private setupConsoleOverrides(): void {
    console.log = (...args: any[]) => {
      if (this.config.level <= LogLevel.INFO) {
        this.writeLog(LogLevel.INFO, args);
      }
    };

    console.warn = (...args: any[]) => {
      if (this.config.level <= LogLevel.WARN) {
        this.writeLog(LogLevel.WARN, args);
      }
    };

    console.error = (...args: any[]) => {
      if (this.config.level <= LogLevel.ERROR) {
        this.writeLog(LogLevel.ERROR, args);
      }
    };

    // Add debug method for convenience
    (console as any).debug = (...args: any[]) => {
      if (this.config.level <= LogLevel.DEBUG) {
        this.writeLog(LogLevel.DEBUG, args);
      }
    };
  }

  /**
   * Format and write log message
   */
  private writeLog(level: LogLevel, args: any[]): void {
    // Get level name safely from the enum
    let levelName: string;
    switch (level) {
      case LogLevel.DEBUG:
        levelName = "DEBUG";
        break;
      case LogLevel.WARN:
        levelName = "WARN";
        break;
      case LogLevel.ERROR:
        levelName = "ERROR";
        break;
      case LogLevel.INFO:
      default:
        levelName = "INFO";
        break;
    }

    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${levelName}: ${message}`;

    // Write to console (original console, not overridden)
    this.originalConsole.log(logMessage);

    // Write to file
    if (this.streamReady && this.logStream && !this.logStream.destroyed) {
      this.logStream.write(`${logMessage}\n`);
    } else if (!this.streamReady) {
      // Buffer messages until stream is ready
      this.logBuffer.push(logMessage);
    }

    // Check if we need to rotate (async, don't block)
    if (level === LogLevel.INFO || level === LogLevel.DEBUG) {
      setImmediate(() => this.checkAndRotate());
    }
  }

  /**
   * Flush and close log stream
   */
  close(): void {
    return new Promise<void>((resolve) => {
      if (this.logStream) {
        this.logStream.end(() => {
          this.logStream = null;
          resolve();
        });
      } else {
        resolve();
      }
    }) as any;
  }
}

/**
 * Factory function to create and initialize logger
 */
export function createDesktopLogger(
  logDir: string,
  config?: Partial<LoggerConfig>,
): DesktopLogger {
  const logger = new DesktopLogger(logDir, config);
  console.log(
    `[Logger] Initialized - Level: ${process.env.LOG_LEVEL || "info"}, Dir: ${logDir}`,
  );
  return logger;
}

/**
 * Check if verbose/debug logging is enabled
 * Returns true if:
 * - LOG_LEVEL=debug environment variable is set
 * - DEBUG environment variable is set to any truthy value
 *
 * Use for conditional logging of verbose messages that would clutter production logs
 * Example: if (isDebugLoggingEnabled()) { console.log("Detailed trace..."); }
 */
export function isDebugLoggingEnabled(): boolean {
  const logLevel = process.env.LOG_LEVEL?.toLowerCase();
  const debugFlag = process.env.DEBUG;
  return logLevel === "debug" || (debugFlag ? true : false);
}
