/\*\*

- Desktop Logger - Log Level & Rotation System
-
- The Electron desktop app now includes a production-ready logging system that:
- - Controls verbosity with log levels (DEBUG, INFO, WARN, ERROR)
- - Automatically rotates log files to prevent unbounded disk usage
- - Keeps old logs for troubleshooting archived versions
- - Filters console output based on environment
- - Conditional verbose logging for protocol handler and other systems
-
- ============================================================================
- DEBUG FLAG & CONDITIONAL LOGGING
- ============================================================================
-
- In addition to log levels, verbose per-request logs can be controlled separately:
-
- **Set DEBUG flag to enable verbose request logs:**
- ```bash

  ```
- DEBUG=1 npm start # Enable verbose logs
- LOG_LEVEL=debug npm start # Also enables debug logs (includes DEBUG flag)
- ```

  ```
-
- **Verbose logs controlled by DEBUG flag:**
- - Protocol handler request traces (every HTTP request to app://)
- - File path resolution details
- - Web-build directory contents listing
-
- **Why separate from LOG_LEVEL?**
- - Protocol handler logs many requests per second in production
- - Would cause massive log file bloat at DEBUG level
- - Can be toggled independently for targeted debugging
- - Default: verbose protocol logs are OFF (clean production logs)
-
- ============================================================================
- LOG LEVELS
- ============================================================================
-
- Set via LOG_LEVEL environment variable:
-
- DEBUG (0) - Most verbose
- - Protocol handler file resolution traces
- - Detailed state changes
- - Performance metrics
- - Automatically enables verbose request logging
- - Use in development for deep troubleshooting
- - Example: LOG_LEVEL=debug npm run desktop:dev
-
- INFO (1) - Standard (DEFAULT)
- - Important application events
- - Window lifecycle (create, close, resize)
- - IPC communication status
- - File operations
- - Startup/shutdown events
- - Suitable for production
- - Note: Verbose per-request logs suppressed (set DEBUG=1 to enable)
-
- WARN (2) - Only warnings and errors
- - Recoverable issues
- - Deprecated API usage
- - Fallback operations
- - Use when you want minimal output
-
- ERROR (3) - Only errors
- - Fatal issues
- - Unhandled exceptions
- - Security violations
- - Use in production when disk space is critical
-
- ============================================================================
- FILE ROTATION
- ============================================================================
-
- **Automatic Rotation:**
- - Triggered when log file exceeds max size (default: 10MB)
- - Files are rotated with numeric suffixes: app.log.1, app.log.2, etc.
- - Old files are deleted when max files limit is reached
-
- **File Naming:**
- ```

  ```
- app.log - Current active log file
- app.log.1 - Most recent rotated file
- app.log.2 - Previously rotated file
- app.log.3, .4, .5 - Older rotated files
- ```

  ```
-
- **Storage:**
- - Windows: %APPDATA%\dnd-toolkit\app.log (and .1, .2, etc.)
- - macOS: ~/Library/Application Support/dnd-toolkit/app.log
- - Linux: ~/.config/dnd-toolkit/app.log
-
- **Maximum Disk Usage:**
- - Default: 10MB file × 5 kept files = ~50MB total
- - Prevents log files from consuming all disk space
- - Old logs are deleted automatically
-
- ============================================================================
- CONFIGURATION VIA ENVIRONMENT VARIABLES
- ============================================================================
-
- **LOG_LEVEL** (default: 'info')
- - Controls output verbosity
- - Values: 'debug' | 'info' | 'warn' | 'error'
- - Example: LOG_LEVEL=debug
-
- **LOG_MAX_SIZE** (default: '10')
- - Maximum log file size in MB before rotation
- - Example: LOG_MAX_SIZE=5 (5MB max before rotation)
- - Affects how frequently rotation occurs
-
- **LOG_MAX_FILES** (default: '5')
- - Number of rotated log files to keep
- - Example: LOG_MAX_FILES=3 (keep 3 rotated files)
- - Older files are deleted automatically
-
- ============================================================================
- USAGE EXAMPLES
- ============================================================================
-
- **Development with full logging (all details):**
- ```bash

  ```
- LOG_LEVEL=debug npm run desktop:dev
- ```

  ```
- Output: DEBUG level logs + all verbose protocol handler traces
- Use case: Deep debugging, protocol issues, every request logged
-
- **Development with debug flag only (verbose without DEBUG level):**
- ```bash

  ```
- DEBUG=1 npm run desktop:dev
- ```

  ```
- Output: INFO level logs + verbose protocol handler traces
- Use case: Normal output but see every HTTP request to app://
-
- **Development with standard logging:**
- ```bash

  ```
- npm run desktop:dev
- ```

  ```
- Output: INFO, WARN, ERROR (default, no verbose traces)
- Use case: Normal development, expected behavior
-
- **Production with minimal output:**
- ```bash

  ```
- LOG_LEVEL=warn npm start
- ```

  ```
- Output: WARN and ERROR only (most critical issues)
- Use case: Minimal disk I/O, warnings and errors only
-
- **Production troubleshooting (enable verbose logs temporarily):**
- ```bash

  ```
- DEBUG=1 npm start
- ```

  ```
- Output: INFO level + all protocol handler traces (for this session)
- Use case: Customer reports issue, enable verbose logging to capture details
-
- **Custom file rotation (more frequent):**
- ```bash

  ```
- LOG_MAX_SIZE=5 LOG_MAX_FILES=3 npm start
- ```

  ```
- Output: Rotate every 5MB, keep only 3 files = ~15MB max
- Use case: Limited disk space, frequent log rotation
-
- **Custom file rotation (less frequent):**
- ```bash

  ```
- LOG_MAX_SIZE=50 LOG_MAX_FILES=10 npm start
- ```

  ```
- Output: Rotate every 50MB, keep 10 files = ~500MB max
- Use case: Plenty of disk space, preserve more history
-
- ============================================================================
- TROUBLESHOOTING
- ============================================================================
-
- **Too many log files consuming disk space:**
- - Reduce LOG_MAX_FILES: LOG_MAX_FILES=2
- - Reduce LOG_MAX_SIZE: LOG_MAX_SIZE=5 (5MB)
- - Increase log level: LOG_LEVEL=warn or error
-
- **Log file stopped being written:**
- - Check file system permissions on userData directory
- - Check available disk space
- - Verify LOG_LEVEL is not set to error-only if you need INFO logs
-
- **Missing debug information:**
- - Run with LOG_LEVEL=debug: LOG_LEVEL=debug npm run desktop:dev
- - Check if protocol handler errors are appearing
- - Look for [Protocol] or [IPC] prefixed messages
-
- **Performance issues from logging:**
- - Reduce LOG_LEVEL to 'warn': LOG_LEVEL=warn
- - Increase LOG_MAX_SIZE to reduce rotation frequency: LOG_MAX_SIZE=50
- - Note: Rotation itself is fast (~100ms), file writing is the bottleneck
-
- ============================================================================
- IMPLEMENTATION DETAILS
- ============================================================================
-
- **How Rotation Works:**
- 1.  Check file size on each log write (asynchronous)
- 2.  If size > maxFileSize:
- - Close current write stream
- - Rename app.log → app.log.1
- - Rename app.log.1 → app.log.2 (etc.)
- - Delete app.log.{maxFiles+1} if it exists
- - Open new write stream for app.log
-
- **Performance:**
- - Logging overhead: ~1ms per write in normal cases
- - Rotation overhead: ~100ms (non-blocking)
- - Memory impact: Minimal (~2MB object overhead)
- - File I/O: Buffered writes, not blocking main thread
-
- **Related Files:**
- - desktop/src/utils/logger.ts - Logger implementation
- - desktop/src/main.ts - Logger initialization
-
- ============================================================================
- BEST PRACTICES
- ============================================================================
-
- **For Development:**
- - Use LOG_LEVEL=debug to see all details
- - Check logs when troubleshooting issues
- - Keep default file size (10MB) for balance
-
- **For Production:**
- - Use LOG_LEVEL=info (default) or warn for minimal overhead
- - Monitor free disk space on target systems
- - Consider user's SSD space before shipping
- - Can safely assume ~10-50MB per log session
-
- **For Deployment:**
- - Document LOG_LEVEL=debug option for customer support
- - Include instructions to set LOG_MAX_FILES=2 for limited disk
- - Log files are in userData directory (user-specific folder)
    \*/

// This file is documentation only
export {};
