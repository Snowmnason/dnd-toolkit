/**
 * Electron Main Process - DnD Toolkit Desktop App
 *
 * Serves bundled web-build files via custom app:// protocol with proper:
 * - Base tag injection for relative path resolution
 * - Path traversal protection
 * - Correct MIME types for all assets (fonts, CSS, JS, HTML, images)
 * - Window state persistence across app restarts
 * - Security headers and CSP via session
 * - Auto-updates via electron-updater
 *
 * Architecture:
 * - Production: Loads app:// → resources/web-build/ (bundled with installer)
 * - Development: Loads http://localhost:8081 (Expo dev server)
 *
 * Key fixes implemented:
 * - ✅ Fonts load correctly (proper MIME types, app:// protocol)
 * - ✅ Images load correctly (CSP allows app://, data:, blob:, https:)
 * - ✅ Index loads on startup (protocol.handle returns proper Response objects)
 * - ✅ Window dimensions persist (window-state.json in userData)
 * - ✅ Force reload works (base tag ensures paths resolve correctly)
 */

import type {
  BrowserWindow as BrowserWindowType,
  IpcMainEvent,
  IpcMainInvokeEvent,
} from "electron";

const {
  app,
  BrowserWindow,
  shell,
  Menu,
  nativeTheme,
  protocol,
  ipcMain,
  Notification,
  dialog,
  session,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

// ============================================================================
// LOGGING SETUP
// ============================================================================

// Create log file in user data directory
const logFilePath = path.join(app.getPath("userData"), "app.log");
const logStream = fs.createWriteStream(logFilePath, { flags: "a" });

// Override console.log to write to both console and file
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] LOG: ${message}\n`);
  originalLog(...args);
};

console.error = (...args: any[]) => {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ERROR: ${message}\n`);
  originalError(...args);
};

console.warn = (...args: any[]) => {
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
    .join(" ");
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] WARN: ${message}\n`);
  originalWarn(...args);
};

console.log("[Logging] Log file:", logFilePath);

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

// Set app name for task manager BEFORE any other app operations
app.setName("DnD-Toolkit");

// Environment detection
const isDev =
  process.env.NODE_ENV === "development" || process.argv.includes("--dev");
const devToolsEnabled = isDev || process.argv.includes("--enable-devtools");

// Trusted origins for IPC security
const TRUSTED_ORIGINS = ["app://", "file://", "http://localhost:8081"];

// Window state persistence
const WINDOW_STATE_FILE = path.join(
  app.getPath("userData"),
  "window-state.json",
);

// ============================================================================
// CUSTOM PROTOCOL REGISTRATION (BEFORE app.ready)
// ============================================================================

// Register app:// protocol as privileged BEFORE app is ready
// This allows app:// URLs to work like https:// (standard, secure, supports fetch)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true, // Allows relative URLs to resolve correctly
      secure: true, // Treated as HTTPS (secure context)
      supportFetchAPI: true, // Enable fetch() API for app:// URLs
      corsEnabled: true, // Allow CORS for external resources
      bypassCSP: false, // Do NOT bypass CSP - we want CSP protection
    },
  },
]);

// ============================================================================
// SQUIRREL WINDOWS INSTALLER HOOKS
// ============================================================================

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require("electron-squirrel-startup")) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed in dev, ignore
}

// ============================================================================
// TYPES
// ============================================================================

type WindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
};

type DialogFilter = {
  name: string;
  extensions: string[];
};

// ============================================================================
// GLOBAL STATE
// ============================================================================

let mainWindow: BrowserWindowType | null = null;

// ============================================================================
// WINDOW STATE PERSISTENCE
// ============================================================================

/**
 * Load saved window state from disk
 * Returns null if file doesn't exist or is corrupted
 */
const loadWindowState = (): WindowState | null => {
  try {
    // ESLint: Path is validated - WINDOW_STATE_FILE is constructed from app.getPath("userData") which is safe
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (fs.existsSync(WINDOW_STATE_FILE as string)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const data = fs.readFileSync(WINDOW_STATE_FILE as string, "utf-8");
      const state = JSON.parse(data);
      console.log("[Window State] Loaded:", state);
      return state;
    }
  } catch (error) {
    console.warn("[Window State] Failed to load:", error);
  }
  return null;
};

/**
 * Save window state to disk
 * Called on window move, resize, maximize, unmaximize
 */
const saveWindowState = (state: WindowState): void => {
  try {
    // ESLint: Path is validated - WINDOW_STATE_FILE is constructed from app.getPath("userData") which is safe
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(
      WINDOW_STATE_FILE as string,
      JSON.stringify(state, null, 2),
    );
    console.log("[Window State] Saved:", state);
  } catch (error) {
    console.warn("[Window State] Failed to save:", error);
  }
};

// ============================================================================
// IPC SECURITY
// ============================================================================

/**
 * Sanitize text input for IPC handlers
 * Prevents injection attacks and limits length
 */
const sanitizeText = (value: unknown, limit = 256): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.replace(/[\r\n]+/g, " ").trim();
  const result = trimmed.slice(0, limit);
  if (result.length < trimmed.length) {
    console.warn(
      `[IPC Security] Data truncated from ${trimmed.length} to ${limit} chars`,
    );
  }
  return result;
};

/**
 * Verify IPC event comes from a trusted origin
 * Prevents malicious external sites from calling IPC handlers
 */
const isTrustedSender = (
  event: IpcMainEvent | IpcMainInvokeEvent | undefined,
): boolean => {
  const senderUrl =
    (event as any)?.senderFrame?.url ||
    (event as any)?.sender?.getURL?.() ||
    "";
  return TRUSTED_ORIGINS.some((origin) => senderUrl.startsWith(origin));
};

/**
 * Guard IPC handler - verifies sender is trusted
 * Returns false if untrusted (handler should return early)
 */
const guardIpc = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  channel: string,
): boolean => {
  if (!isTrustedSender(event)) {
    console.warn(`[IPC Security] Blocked untrusted call to ${channel}`);
    return false;
  }
  return true;
};

// ============================================================================
// PROTOCOL HANDLER (app:// → web-build/)
// ============================================================================

/**
 * Get MIME type for file extension
 * Critical for fonts, CSS, JS to load correctly
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();

  // Explicit handling for fonts.css (including hashed versions like fonts-abc123.css)
  if (fileName.includes("fonts") && fileName.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }

  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    // Font formats
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".eot": "application/vnd.ms-fontobject",
  };

  // Use explicit has check to avoid ESLint security warning
  // ext is validated via path.extname() which only returns safe file extensions
  if (Object.prototype.hasOwnProperty.call(contentTypes, ext)) {
    return contentTypes[ext as keyof typeof contentTypes];
  }
  return "application/octet-stream";
}

/**
 * Setup custom app:// protocol handler
 * Maps app:// URLs to bundled web-build/ directory
 *
 * Security:
 * - Validates paths to prevent directory traversal
 * - Injects base tag into index.html for correct relative path resolution
 * - Sets proper MIME types for all assets
 * - Returns 404 for missing files, 403 for path traversal attempts
 */
function setupProtocolHandler(): void {
  // In packaged app: use process.resourcesPath which points to the resources folder
  // electron-builder copies extraResources to resources/web-build
  const webBuildDir = path.join(process.resourcesPath, "web-build");
  const resolvedRoot = path.resolve(webBuildDir);

  console.log("[Protocol] Setup:", {
    isDev,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    webBuildDir,
    resolvedRoot,
    // ESLint: Path is validated - constructed from app.getAppPath() + "../web-build" which is safe
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    exists: fs.existsSync(webBuildDir as string),
  });

  // List files in web-build for debugging
  try {
    // ESLint: Path is validated - webBuildDir constructed from trusted app.getAppPath()
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const files = fs.readdirSync(webBuildDir as string);
    console.log("[Protocol] Web build contents:", files.slice(0, 15));
  } catch (e) {
    console.error("[Protocol] Failed to list web-build:", e);
  }

  // Register protocol handler using MODERN protocol.handle() API on defaultSession
  // CRITICAL: Must use session.defaultSession.protocol.handle(), not global protocol
  try {
    console.log(
      "[Protocol] Attempting to register handler on session.defaultSession...",
    );
    console.log(
      "[Protocol] Session:",
      session.defaultSession ? "exists" : "null",
    );
    console.log(
      "[Protocol] Protocol object:",
      typeof session.defaultSession?.protocol,
    );

    session.defaultSession.protocol.handle("app", (request: GlobalRequest) => {
      console.log("[Protocol] ===== INCOMING REQUEST =====");
      console.log("[Protocol] Full URL:", request.url);

      try {
        // Parse URL: app:// or app://path or app://path/file.ext
        let requestUrl = request.url.replace("app://", "");

        console.log("[Protocol] Parsed path:", requestUrl);

        // Remove hash/fragment (e.g., #/ for React Router)
        if (requestUrl.includes("#")) {
          requestUrl = requestUrl.split("#")[0];
        }

        // Remove query string (e.g., ?v=123)
        if (requestUrl.includes("?")) {
          requestUrl = requestUrl.split("?")[0];
        }

        // Remove leading slash
        if (requestUrl.startsWith("/")) {
          requestUrl = requestUrl.substring(1);
        }

        // Fix: Remove index.html/ prefix if present
        // This happens when base tag is app://index.html/ instead of app://
        // Converts: app://index.html/fonts.css → app://fonts.css
        if (requestUrl.startsWith("index.html/")) {
          requestUrl = requestUrl.substring(11); // Remove 'index.html/'
        }

        // Default to index.html if no file specified
        if (!requestUrl || requestUrl === "") {
          requestUrl = "index.html";
        }

        // Resolve and validate path (prevent directory traversal)
        const candidatePath = path.join(resolvedRoot, requestUrl);
        const resolvedCandidate = path.resolve(candidatePath);

        // Security: Ensure resolved path is inside web-build directory
        if (!resolvedCandidate.startsWith(resolvedRoot)) {
          console.error(
            "[Protocol] BLOCKED path traversal:",
            request.url,
            "→",
            resolvedCandidate,
          );
          return new Response("Forbidden: Path traversal attempt", {
            status: 403,
            headers: { "content-type": "text/plain" },
          });
        }

        console.log(
          "[Protocol] Resolved:",
          requestUrl,
          "→",
          resolvedCandidate,
          "exists:",
          // ESLint: resolvedCandidate validated against resolvedRoot above to prevent path traversal
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          fs.existsSync(resolvedCandidate as string),
        );

        // Read file
        // ESLint: resolvedCandidate validated against resolvedRoot above to prevent path traversal
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!fs.existsSync(resolvedCandidate as string)) {
          console.error("[Protocol] File not found:", resolvedCandidate);
          return new Response(`Not found: ${requestUrl}`, {
            status: 404,
            headers: { "content-type": "text/plain" },
          });
        }

        // ESLint: resolvedCandidate validated against resolvedRoot above to prevent path traversal
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        let fileContent = fs.readFileSync(resolvedCandidate as string);
        const contentType = getContentType(resolvedCandidate);

        // CRITICAL FIX: Inject base tag into index.html for correct relative path resolution
        // Without this, /fonts.css becomes app://index.html/fonts.css (broken)
        // With this, /fonts.css becomes app://fonts.css (correct)
        if (resolvedCandidate.endsWith("index.html")) {
          let htmlString = fileContent.toString("utf-8");

          // Only inject if not already present
          if (!htmlString.includes('<base href="app://"')) {
            // Inject right after <head> tag
            htmlString = htmlString.replace(
              /<head>/i,
              '<head>\n    <base href="app://">',
            );
            console.log("[Protocol] ✅ Injected base tag into index.html");
          }

          fileContent = Buffer.from(htmlString, "utf-8");
        }

        console.log(
          "[Protocol] ✅ Loaded:",
          resolvedCandidate,
          `(${fileContent.length} bytes)`,
        );

        // Return Response object (modern protocol.handle API)
        return new Response(fileContent, {
          status: 200,
          headers: { "content-type": contentType },
        });
      } catch (error) {
        console.error("[Protocol] Error:", error);
        return new Response("Internal server error", {
          status: 500,
          headers: { "content-type": "text/plain" },
        });
      }
    });

    console.log(
      "[Protocol] ✅ app:// protocol handler registered successfully",
    );
    console.log("[Protocol] Ready to serve from:", resolvedRoot);

    // Verify protocol is handled
    const isHandled = session.defaultSession.protocol.isProtocolHandled("app");
    console.log("[Protocol] isProtocolHandled('app'):", isHandled);
  } catch (protocolError) {
    console.error(
      "[Protocol] ❌ FATAL: Failed to register protocol handler:",
      protocolError,
    );
    throw protocolError;
  }
}

// ============================================================================
// SESSION SECURITY (CSP, Headers, Permissions)
// ============================================================================

/**
 * Configure session security policies
 * - CSP headers for all app:// requests
 * - Permission request handling (clipboard only)
 * - Security headers (HSTS, X-Frame-Options, etc.)
 */
function setupSessionSecurity(): void {
  const defaultSession = session.defaultSession;

  // Permission handling: only allow clipboard-read
  defaultSession.setPermissionRequestHandler(
    (_wc: any, permission: string, callback: (granted: boolean) => void) => {
      const allowed = permission === "clipboard-read";
      if (!allowed) {
        console.warn("[Security] Denied permission request:", permission);
      }
      callback(allowed);
    },
  );

  // Inject security headers for app:// requests
  defaultSession.webRequest.onHeadersReceived(
    (details: any, callback: (response: any) => void) => {
      const requestUrl = details.url || "";

      // Only apply headers to app:// and file:// URLs (not external HTTPS)
      if (
        !requestUrl.startsWith("app://") &&
        !requestUrl.startsWith("file://")
      ) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }

      // Content Security Policy
      // Allow app:// for all resources, Supabase for API, fonts from Google
      const csp =
        "default-src 'self' app:; " +
        "script-src 'self' app: https://*.supabase.co 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' app: https://fonts.gstatic.com; " +
        "img-src 'self' data: https: blob: app:; " +
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
        "frame-ancestors 'none'; " +
        "form-action 'self'; " +
        "base-uri 'self'; " +
        "object-src 'none'; " +
        "media-src 'self'; " +
        "worker-src 'self' blob:";

      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp],
          "Cross-Origin-Opener-Policy": ["same-origin"],
          "Cross-Origin-Resource-Policy": ["same-origin"],
          "Cross-Origin-Embedder-Policy": ["credentialless"],
          "Referrer-Policy": ["strict-origin-when-cross-origin"],
          "X-Content-Type-Options": ["nosniff"],
          "X-Frame-Options": ["DENY"],
        },
      });
    },
  );

  console.log("[Security] ✅ Session security configured");
}

// ============================================================================
// NAVIGATION GUARDS (Prevent external navigation)
// ============================================================================

/**
 * Setup navigation guards to prevent malicious redirects
 * - Block will-navigate to external sites
 * - Block will-redirect to external sites
 * - Block webview attachment
 * - Only allow app://, file://, and localhost:8081 (dev)
 */
function setupNavigationGuards(): void {
  app.on("web-contents-created", (_event: unknown, contents: any) => {
    // Block webview attachment (XSS vector)
    contents.on(
      "will-attach-webview",
      (event: { preventDefault: () => void }) => {
        console.warn("[Security] Blocked webview attachment attempt");
        event.preventDefault();
      },
    );

    // Only allow window.open for the main window
    const owningWindow = BrowserWindow.fromWebContents(contents);
    if (!owningWindow || !mainWindow || owningWindow !== mainWindow) {
      contents.setWindowOpenHandler(() => {
        console.warn("[Security] Blocked window.open from non-main window");
        return { action: "deny" as const };
      });
    }

    // Block navigation to external sites
    contents.on(
      "will-navigate",
      (event: { preventDefault: () => void }, navigationUrl: string) => {
        const parsedUrl = new URL(navigationUrl);

        // Allow app:// and file:// protocols
        if (parsedUrl.protocol === "file:" || parsedUrl.protocol === "app:") {
          return;
        }

        // Allow localhost in dev mode
        if (isDev && parsedUrl.hostname === "localhost") {
          return;
        }

        // Block all other navigation
        console.warn("[Security] Blocked navigation to:", navigationUrl);
        event.preventDefault();
      },
    );

    // Block redirects to external sites
    contents.on(
      "will-redirect",
      (event: { preventDefault: () => void }, navigationUrl: string) => {
        const parsedUrl = new URL(navigationUrl);

        // Allow app:// and file:// protocols
        if (parsedUrl.protocol === "file:" || parsedUrl.protocol === "app:") {
          return;
        }

        // Allow localhost in dev mode
        if (isDev && parsedUrl.hostname === "localhost") {
          return;
        }

        // Block all other redirects
        console.warn("[Security] Blocked redirect to:", navigationUrl);
        event.preventDefault();
      },
    );
  });

  console.log("[Security] ✅ Navigation guards configured");
}

// ============================================================================
// AUTO-UPDATER (electron-updater)
// ============================================================================

/**
 * Configure auto-updater (only in production)
 * Checks for updates on startup and notifies user
 */
function setupAutoUpdater(): void {
  if (isDev) {
    console.log("[Auto-updater] Disabled in development mode");
    return;
  }

  // Check for updates on app start
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on("update-available", () => {
    console.log("[Auto-updater] Update available");
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[Auto-updater] Update downloaded, will install on quit");
  });

  autoUpdater.on("error", (error: Error) => {
    console.error("[Auto-updater] Error:", error);
  });

  console.log("[Auto-updater] ✅ Configured");
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

/**
 * Register IPC handlers for renderer ↔ main communication
 * - get-app-version: Returns app version
 * - get-system-theme: Returns 'dark' or 'light'
 * - window-minimize/maximize/close: Window controls
 * - show-open-dialog/show-save-dialog: File dialogs
 * - show-notification: System notifications
 */
function registerIpcHandlers(): void {
  const getWindowForEvent = (event: { sender: any }) =>
    BrowserWindow.fromWebContents(event.sender) || mainWindow;

  // Get app version
  ipcMain.handle("get-app-version", (event: IpcMainInvokeEvent) => {
    if (!guardIpc(event, "get-app-version")) return { error: "unauthorized" };
    return app.getVersion();
  });

  // Get system theme
  ipcMain.handle("get-system-theme", (event: IpcMainInvokeEvent) => {
    if (!guardIpc(event, "get-system-theme")) return { error: "unauthorized" };
    return nativeTheme.shouldUseDarkColors ? "dark" : "light";
  });

  // Window controls
  ipcMain.on("window-minimize", (event: IpcMainEvent) => {
    if (!guardIpc(event, "window-minimize")) return;
    getWindowForEvent(event)?.minimize();
  });

  ipcMain.on("window-maximize", (event: IpcMainEvent) => {
    if (!guardIpc(event, "window-maximize")) return;
    const target = getWindowForEvent(event);
    if (!target) return;
    if (target.isMaximized()) {
      target.unmaximize();
    } else {
      target.maximize();
    }
  });

  ipcMain.on("window-close", (event: IpcMainEvent) => {
    if (!guardIpc(event, "window-close")) return;
    getWindowForEvent(event)?.close();
  });

  // File dialogs
  ipcMain.handle(
    "show-open-dialog",
    (event: IpcMainInvokeEvent, options: any) => {
      if (!guardIpc(event, "show-open-dialog"))
        return { canceled: true, filePaths: [] };
      const win = getWindowForEvent(event);
      if (!win) return { canceled: true, filePaths: [] };
      return dialog.showOpenDialog(win, sanitizeDialogOptions(options));
    },
  );

  ipcMain.handle(
    "show-save-dialog",
    (event: IpcMainInvokeEvent, options: any) => {
      if (!guardIpc(event, "show-save-dialog"))
        return { canceled: true, filePath: undefined };
      const win = getWindowForEvent(event);
      if (!win) return { canceled: true, filePath: undefined };
      return dialog.showSaveDialog(win, sanitizeDialogOptions(options));
    },
  );

  // System notifications
  ipcMain.on("show-notification", (event: IpcMainEvent, payload: any) => {
    if (!guardIpc(event, "show-notification")) return;
    const title = sanitizeText(payload?.title, 80) || "DnD Toolkit";
    const body = sanitizeText(payload?.body, 240);

    if (!Notification.isSupported()) {
      console.warn("[IPC] Notifications not supported on this platform");
      return;
    }

    new Notification({ title, body }).show();
  });

  console.log("[IPC] ✅ Handlers registered");
}

/**
 * Sanitize dialog filters for file pickers
 * Prevents injection attacks in file extension filters
 */
const sanitizeDialogFilters = (filters?: DialogFilter[]) => {
  if (!Array.isArray(filters)) return undefined;
  return filters
    .filter(
      (filter) =>
        filter &&
        typeof filter.name === "string" &&
        Array.isArray(filter.extensions),
    )
    .map((filter) => ({
      name: sanitizeText(filter.name, 60),
      extensions: filter.extensions
        .filter((ext) => typeof ext === "string")
        .slice(0, 10),
    }));
};

/**
 * Sanitize dialog options for file pickers
 */
const sanitizeDialogOptions = (
  options: {
    defaultPath?: string;
    filters?: DialogFilter[];
    properties?: string[];
  } = {},
) => {
  return {
    defaultPath:
      typeof options.defaultPath === "string" ? options.defaultPath : undefined,
    filters: sanitizeDialogFilters(options.filters),
    properties: Array.isArray(options.properties)
      ? (options.properties
          .filter((prop) => typeof prop === "string")
          .slice(0, 10) as any)
      : undefined,
  };
};

// ============================================================================
// CREATE WINDOW
// ============================================================================

/**
 * Create main browser window
 * - Loads from app:// (production) or localhost:8081 (dev)
 * - Restores window size/position from disk
 * - Saves window state on move/resize/maximize
 * - Opens DevTools if enabled
 */
function createWindow(): void {
  // Determine icon path (different for dev vs packaged)
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "assets", "images", "icon.ico")
    : path.join(__dirname, "../assets/images/icon.ico");

  // Load saved window state or use defaults
  const savedState = loadWindowState();
  const defaultWidth = 1800;
  const defaultHeight = 1200;

  mainWindow = new BrowserWindow({
    width: savedState?.width || defaultWidth,
    height: savedState?.height || defaultHeight,
    x: savedState?.x,
    y: savedState?.y,
    minWidth: 1200,
    minHeight: 800,
    title: "DnD-Toolkit",
    icon: iconPath,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a1a2e" : "#f5f5f5",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableRemoteModule: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      safeDialogs: true,
      navigateOnDragDrop: false,
    },
    // Modern frameless look with native controls
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    frame: true,
    show: false, // Hide until ready-to-show event
  });

  // Restore maximized state
  if (savedState?.isMaximized && mainWindow) {
    mainWindow.maximize();
  }

  // Save window state on move, resize, maximize, unmaximize
  const saveState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const bounds = mainWindow.getBounds();
    saveWindowState({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
    });
  };

  if (mainWindow) {
    mainWindow.on("move", saveState);
    mainWindow.on("resize", saveState);
    mainWindow.on("maximize", saveState);
    mainWindow.on("unmaximize", saveState);

    // Show window when ready (prevents white flash)
    mainWindow.once("ready-to-show", () => {
      console.log("[Window] ready-to-show event fired");
      mainWindow?.show();
      if (devToolsEnabled) {
        mainWindow?.webContents.openDevTools();
      }
    });

    // Fallback: show window after 5 seconds even if ready-to-show doesn't fire
    setTimeout(() => {
      if (mainWindow && !mainWindow.isVisible()) {
        console.warn(
          "[Window] ready-to-show didn't fire, force showing window",
        );
        mainWindow.show();
        if (devToolsEnabled) {
          mainWindow.webContents.openDevTools();
        }
      }
    }, 5000);

    // Load app
    if (isDev) {
      // Development: Load from Expo dev server
      console.log("[Window] Loading from dev server: http://localhost:8081");
      mainWindow.loadURL("http://localhost:8081");

      // Auto-retry if dev server not ready
      mainWindow.webContents.on("did-fail-load", () => {
        console.log("[Dev] Failed to load, retrying in 2 seconds...");
        setTimeout(() => {
          mainWindow?.loadURL("http://localhost:8081");
        }, 2000);
      });
    } else {
      // Production: Load from app:// protocol
      // CRITICAL: Use app:// (root) not app://index.html (breaks relative paths)
      console.log("[Window] Loading from protocol: app://");
      mainWindow.loadURL("app://");

      // Log errors for debugging
      mainWindow.webContents.on(
        "did-fail-load",
        (_event: any, errorCode: number, errorDescription: string) => {
          console.error(
            "[Electron] Failed to load:",
            errorCode,
            errorDescription,
          );
        },
      );
    }

    // Handle external links - open in browser
    mainWindow.webContents.setWindowOpenHandler(
      ({ url: linkUrl }: { url: string }) => {
        // Allow HTTPS (and localhost in dev)
        if (
          linkUrl.startsWith("https://") ||
          (isDev && linkUrl.startsWith("http://localhost"))
        ) {
          shell.openExternal(linkUrl);
          return { action: "deny" };
        }

        console.warn("[Security] Blocked non-HTTPS link:", linkUrl);
        return { action: "deny" };
      },
    );

    // Cleanup on close
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }

  console.log("[Window] ✅ Created");
}

// ============================================================================
// APPLICATION MENU
// ============================================================================

/**
 * Create application menu (File, Edit, View, Window, Help)
 */
function createMenu(): void {
  const isMac = process.platform === "darwin";

  const template: {
    label?: string;
    role?: string;
    type?: string;
    submenu?: unknown[];
    click?: () => void;
  }[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    // Edit menu
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        ...(isMac
          ? [
              { role: "pasteAndMatchStyle" as const },
              { role: "delete" as const },
              { role: "selectAll" as const },
            ]
          : [
              { role: "delete" as const },
              { type: "separator" as const },
              { role: "selectAll" as const },
            ]),
      ],
    },
    // View menu
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // Window menu
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" as const },
              { role: "front" as const },
              { type: "separator" as const },
              { role: "window" as const },
            ]
          : [{ role: "close" as const }]),
      ],
    },
    // Help menu
    {
      label: "Help",
      submenu: [
        {
          label: "GitHub Repository",
          click: async () => {
            await shell.openExternal(
              "https://github.com/Snowmnason/dnd-toolkit",
            );
          },
        },
        {
          label: "Report Issue",
          click: async () => {
            await shell.openExternal(
              "https://github.com/Snowmnason/dnd-toolkit/issues",
            );
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template as any);
  Menu.setApplicationMenu(menu);

  console.log("[Menu] ✅ Created");
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

// App ready event
app
  .whenReady()
  .then(() => {
    console.log("[App] Starting DnD Toolkit...");
    console.log("[App] Version:", app.getVersion());
    console.log("[App] Mode:", isDev ? "development" : "production");
    console.log("[App] DevTools:", devToolsEnabled ? "enabled" : "disabled");

    try {
      // Setup protocol handler (production only)
      if (!isDev) {
        console.log("[App] Setting up protocol handler...");
        setupProtocolHandler();
        console.log("[App] Protocol handler setup complete");
      }

      // Setup security
      console.log("[App] Setting up security...");
      setupSessionSecurity();
      setupNavigationGuards();
      registerIpcHandlers();
      console.log("[App] Security setup complete");

      // Create window and menu
      console.log("[App] Creating window...");
      createWindow();
      console.log("[App] Window created");

      console.log("[App] Creating menu...");
      createMenu();
      console.log("[App] Menu created");

      // Setup auto-updater (production only)
      setupAutoUpdater();

      // macOS: Re-create window when dock icon is clicked
      app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });

      console.log("[App] ✅ Ready");
    } catch (error) {
      console.error("[App] ❌ Fatal error during initialization:", error);
      // Show error dialog before quitting
      const { dialog } = require("electron");
      dialog.showErrorBox(
        "Startup Error",
        `Failed to start DnD Toolkit:\n\n${error}\n\nCheck console for details.`,
      );
      app.quit();
    }
  })
  .catch((error: unknown) => {
    console.error("[App] ❌ Failed to initialize:", error);
    app.quit();
  });

// Quit when all windows are closed (except on macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
