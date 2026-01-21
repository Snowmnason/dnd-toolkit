/**
 * SIMPLE Electron Main Process Logger
 *
 * ✅ PRODUCTION VERSION - Error logging only
 *
 * - Error-only logging (app is stable, no need for verbose logs)
 * - Async queue prevents main thread blocking
 * - All errors go to file with timestamps
 * - Console output for visibility
 */

import * as fs from "fs";
import * as path from "path";

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// Queue for async log writes to prevent blocking main thread
let logQueue: { message: string; isError?: boolean }[] = [];
let isWriting = false;
let logFilePath = "";

/**
 * Process log queue asynchronously to avoid blocking main thread
 */
async function processLogQueue() {
  if (isWriting || logQueue.length === 0) return;

  isWriting = true;
  const logs = logQueue.splice(0, 10); // Process in batches

  try {
    const batch = logs.map((l) => `${l.message}`).join("\n") + "\n";
    await fs.promises.appendFile(logFilePath, batch, "utf-8");
  } catch (error) {
    originalError("[Logger] Failed to write logs:", error);
  }

  isWriting = false;

  // Process remaining queue
  if (logQueue.length > 0) {
    setImmediate(() => processLogQueue());
  }
}

/**
 * Check if debug logging is enabled (for backward compatibility)
 */
export function isDebugLoggingEnabled(): boolean {
  return (
    process.env.LOG_LEVEL === "debug" ||
    process.argv.includes("--enable-logging")
  );
}

/**
 * Create and initialize logger
 * Overrides console.error to write to file
 * Reduces console.log/warn to only pass through (no file writes)
 */
export function createDesktopLogger(logDir: string, _config?: any): void {
  logFilePath = path.join(logDir, "app.log");

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

  // Override console.log - passthrough only (no file writes)
  console.log = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");

    // Just output to console, no file write
    originalLog(message);
  };

  // Override console.error - log to file with async queue
  console.error = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ERROR: ${message}`;

    // Queue for async write (prevents blocking)
    logQueue.push({ message: logMessage, isError: true });
    processLogQueue();

    // Also output to console immediately
    originalError(logMessage);
  };

  // Override console.warn - passthrough only (no file writes)
  console.warn = (...args: any[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
      )
      .join(" ");
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] WARN: ${message}`;

    // Just output to console, no file write
    originalWarn(logMessage);
  };

  // Add debug method - no-op in production
  (console as any).debug = (..._args: any[]) => {
    // Debug logging disabled in production
  };
}
