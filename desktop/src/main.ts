/**
 * Electron Main Process
 * Loads the web build of DnD Toolkit in a native window
 */

const { app, BrowserWindow, shell, Menu, nativeTheme, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const fs = require('fs');

// Set app name for task manager BEFORE any other app operations
app.setName('DnD-Toolkit');

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch {
  // electron-squirrel-startup not installed, ignore
}

let mainWindow: typeof BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

// Configure auto-updates (only in production)
function setupAutoUpdater(): void {
  if (isDev) {
    console.log('[Auto-updater] Disabled in development mode');
    return;
  }

  // Configure electron-updater
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('[Auto-updater] Update available');
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Auto-updater] Update downloaded, will install on app quit');
  });

  autoUpdater.on('error', (error: Error) => {
    console.error('[Auto-updater] Error:', error);
  });
}

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'DnD-Toolkit',
    icon: path.join(__dirname, '../assets/images/icon.ico'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    // Modern frameless look with native controls
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: true,
    show: false, // Don't show until ready
  });

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Load the app
  if (isDev) {
    // In development, load from Expo dev server
    mainWindow.loadURL('http://localhost:8081');
    
    // Hot reload: refresh when files change
    mainWindow.webContents.on('did-fail-load', () => {
      console.log('Failed to load dev server, retrying in 2 seconds...');
      setTimeout(() => {
        mainWindow?.loadURL('http://localhost:8081');
      }, 2000);
    });
  } else {
    // In production, load using custom protocol
    mainWindow.loadURL('app://index.html#/');
    
    // Log any resource loading errors for debugging
    mainWindow.webContents.on('did-fail-load', (_event: any, errorCode: number, errorDescription: string) => {
      console.error('[Electron] Failed to load resource:', errorCode, errorDescription);
    });
  }

  // Handle external links - open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url: linkUrl }: { url: string }) => {
    if (linkUrl.startsWith('http://') || linkUrl.startsWith('https://')) {
      shell.openExternal(linkUrl);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: { label?: string; role?: string; type?: string; submenu?: unknown[]; click?: () => void }[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File menu
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [{ role: 'delete' as const }, { type: 'separator' as const }, { role: 'selectAll' as const }]),
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }, { type: 'separator' as const }, { role: 'window' as const }]
          : [{ role: 'close' as const }]),
      ],
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/thesnowpost/dnd-toolkit');
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/thesnowpost/dnd-toolkit/issues');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App lifecycle events
app.whenReady().then(() => {
  // Register custom protocol handler for production builds
  if (!isDev) {
    // In packaged app: app.getAppPath() = app.asar/
    // We need: resources/web-build/ (same resolution across platforms)
    const webBuildDir = path.join(app.getAppPath(), '..', 'web-build');
    
    console.log('[Electron] isDev:', isDev);
    console.log('[Electron] App path:', app.getAppPath());
    console.log('[Electron] Web build directory:', webBuildDir);
    console.log('[Electron] Resolved path:', path.resolve(webBuildDir));
    console.log('[Electron] Web build exists:', fs.existsSync(webBuildDir));
    
    // List files in web-build for debugging
    try {
      const files = fs.readdirSync(webBuildDir);
      console.log('[Electron] Web build contents:', files.slice(0, 10));
    } catch (e) {
      console.error('[Electron] Failed to list web-build:', e);
    }
    
    protocol.handle('app', (request: { url: string }) => {
      let requestUrl = request.url.replace('app://', '');
      
      // Remove hash/fragment (e.g., #/ for routing)
      if (requestUrl.includes('#')) {
        requestUrl = requestUrl.split('#')[0];
      }
      
      // Remove leading slash if present
      if (requestUrl.startsWith('/')) {
        requestUrl = requestUrl.substring(1);
      }
      
      // Default to index.html if no file specified
      if (!requestUrl || requestUrl === '') {
        requestUrl = 'index.html';
      }

      // Normalize and guard against traversal
      const normalizedPath = path.normalize(requestUrl);
      const candidatePath = path.join(webBuildDir, normalizedPath);
      const resolvedRoot = path.resolve(webBuildDir);
      const resolvedCandidate = path.resolve(candidatePath);

      if (!resolvedCandidate.startsWith(resolvedRoot)) {
        console.error('[Electron] Blocked path traversal:', request.url, '→', resolvedCandidate);
        return new Response('Forbidden', { status: 403 });
      }
      
      console.log('[Electron] Protocol request:', request.url, '→', resolvedCandidate, 'exists:', fs.existsSync(resolvedCandidate));
      
      try {
        const fileContent = fs.readFileSync(resolvedCandidate);
        console.log('[Electron] Loaded:', resolvedCandidate);
        return new Response(fileContent, {
          headers: {
            'content-type': getContentType(resolvedCandidate),
          },
        });
      } catch (error) {
        console.error('[Electron] Failed to load file:', resolvedCandidate, error);
        return new Response('File not found: ' + resolvedCandidate, { status: 404 });
      }
    });
  }
  
  createMenu();
  createWindow();
  setupAutoUpdater();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to unknown URLs
app.on('web-contents-created', (_event: unknown, contents: { on: (event: string, handler: (e: { preventDefault: () => void }, url: string) => void) => void }) => {
  contents.on('will-navigate', (event: { preventDefault: () => void }, navigationUrl: string) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow localhost for dev, app protocol for production, and file protocol
    if (parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'app:' && parsedUrl.hostname !== 'localhost') {
      event.preventDefault();
    }
  });
});

// Helper function to determine content type from file extension
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  return contentTypes[ext] || 'application/octet-stream';
}
