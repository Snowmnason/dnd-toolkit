/**
 * Electron Preload Script
 * Provides a secure bridge between the renderer and main process
 *
 * This runs in a sandboxed context with limited Node.js access
 */

const { contextBridge, ipcRenderer } = require("electron");

interface DialogFilter {
  name: string;
  extensions: string[];
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Platform info
  platform: process.platform,
  isElectron: true,

  // App info
  getVersion: () => ipcRenderer.invoke("get-app-version"),

  // Window controls (for custom titlebar if needed)
  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close"),

  // Theme
  getSystemTheme: () => ipcRenderer.invoke("get-system-theme"),
  onThemeChange: (callback: (theme: "light" | "dark") => void) => {
    const listener = (_event: unknown, theme: "light" | "dark") => {
      callback(theme);
    };
    ipcRenderer.on("theme-changed", listener);
    // Return cleanup function to prevent memory leaks
    return () => {
      ipcRenderer.removeListener("theme-changed", listener);
    };
  },

  // File operations (for future use - importing/exporting data)
  showSaveDialog: (options: {
    defaultPath?: string;
    filters?: DialogFilter[];
  }) => ipcRenderer.invoke("show-save-dialog", options),
  showOpenDialog: (options: {
    filters?: DialogFilter[];
    properties?: string[];
  }) => ipcRenderer.invoke("show-open-dialog", options),

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.send("show-notification", { title, body }),
});

// Type declarations for the exposed API
declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      isElectron: boolean;
      getVersion: () => Promise<string>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      getSystemTheme: () => Promise<"light" | "dark">;
      onThemeChange: (
        callback: (theme: "light" | "dark") => void,
      ) => () => void; // Returns cleanup function
      showSaveDialog: (options: {
        defaultPath?: string;
        filters?: DialogFilter[];
      }) => Promise<{ canceled: boolean; filePath?: string }>;
      showOpenDialog: (options: {
        filters?: DialogFilter[];
        properties?: string[];
      }) => Promise<{ canceled: boolean; filePaths: string[] }>;
      showNotification: (title: string, body: string) => void;
    };
  }
}

export { };

