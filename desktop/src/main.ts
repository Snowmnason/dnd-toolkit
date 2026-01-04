/**
 * Electron Main Process
 * Loads the web build of DnD Toolkit in a native window
 */

const { app, BrowserWindow, shell, Menu, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

// Set app name for task manager BEFORE any other app operations
app.setName('DnD-Toolkit');

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
    icon: path.join(__dirname, '../assets/images/icon.png'),
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
    // In production, load the exported web build from extraResources
    const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || '';
    const webBuildPath = path.join(resourcesPath, 'web-build', 'index.html');
    mainWindow.loadURL(
      url.format({
        pathname: webBuildPath,
        protocol: 'file:',
        slashes: true,
      })
    );
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
    
    // Allow localhost for dev and file protocol for production
    if (parsedUrl.protocol !== 'file:' && parsedUrl.hostname !== 'localhost') {
      event.preventDefault();
    }
  });
});
