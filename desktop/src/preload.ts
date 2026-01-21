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
    // IMPORTANT: Consumers MUST call this cleanup function in useEffect cleanup
    // to avoid listener accumulation and memory leaks on component unmount.
    //
    // Example usage in React component:
    // ```tsx
    // useEffect(() => {
    //   const cleanup = window.electronAPI.onThemeChange((theme) => {
    //     console.log('System theme changed to:', theme);
    //     // Update component state or trigger theme sync
    //   });
    //   return cleanup; // Call cleanup on unmount
    // }, []);
    // ```
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
      /**
       * Listen for system theme changes (OS-level light/dark mode changes)
       *
       * Returns a cleanup function that MUST be called in useEffect cleanup
       * to prevent memory leaks from event listener accumulation.
       *
       * Usage in React:
       * ```tsx
       * useEffect(() => {
       *   const cleanup = window.electronAPI.onThemeChange((theme) => {
       *     console.log('System theme changed:', theme);
       *   });
       *   return cleanup; // CRITICAL: Call cleanup on unmount
       * }, []);
       * ```
       *
       * Failing to call the cleanup function will cause:
       * - Multiple listeners accumulating on component re-mounts
       * - Memory leaks from unreferenced listener functions
       * - Theme change callbacks being called multiple times
       */
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

