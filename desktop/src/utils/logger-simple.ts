/**
 * SIMPLE Electron Main Process Logger
 *
 * ✅ WORKING VERSION - DO NOT OVERCOMPLICATE
 *
 * - Synchronous writes (no async issues)
 * - All logs go to file immediately
 * - No buffering, no state machine
 * - Supports LOG_LEVEL environment variable
 */

import * as fs from "fs";
import * as path from "path";

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

/**
 * Check if debug logging is enabled
 */
export function isDebugLoggingEnabled(): boolean {
  return (
    process.env.LOG_LEVEL === "debug" ||
    process.argv.includes("--enable-logging")
  );
}

/**
 * Create and initialize logger
 * Overrides console.log/error/warn to write to file
 */
export function createDesktopLogger(logDir: string, _config?: any): void {
  const logFilePath = path.join(logDir, "app.log");

  // Ensure log directory exists
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (error) {
    originalError("[Logger] Failed to create log directory:", error);
  }

  // Clear old log file to start fresh
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(logFilePath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.unlinkSync(logFilePath);
    }
  } catch (error) {
    originalError("[Logger] Failed to clear old log file:", error);
  }

  // Override console.log
  console.log = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] LOG: ${message}`;

    // Write to file (synchronous)
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(logFilePath, `${logMessage}\n`, "utf-8");
    } catch (error) {
      originalError("[Logger] Failed to write log:", error);
    }

    // Also output to console
    originalLog(logMessage);
  };

  // Override console.error
  console.error = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;

    // Write to file (synchronous)
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(logFilePath, `${logMessage}\n`, "utf-8");
    } catch (error) {
      originalError("[Logger] Failed to write error log:", error);
    }

    // Also output to console
    originalError(logMessage);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}`;

    // Write to file (synchronous)
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(logFilePath, `${logMessage}\n`, "utf-8");
    } catch (error) {
      originalError("[Logger] Failed to write warn log:", error);
    }

    // Also output to console
    originalWarn(logMessage);
  };

  // Add debug method
  (console as any).debug = (...args: any[]) => {
    if (!isDebugLoggingEnabled()) return;

    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] DEBUG: ${message}`;

    // Write to file (synchronous)
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.appendFileSync(logFilePath, `${logMessage}\n`, "utf-8");
    } catch (error) {
      originalError("[Logger] Failed to write debug log:", error);
    }

    // Also output to console
    originalLog(logMessage);
  };
}
