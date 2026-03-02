/**
 * 🔤 Web Font Injection Utility
 * Loads fonts.css on web to make custom fonts available
 */

import { logger } from '../logger';

export async function injectWebFonts(): Promise<void> {
  if (typeof document === "undefined") {
    return; // Not running on web
  }

  try {
    // Detect if running in Electron
    const isElectron = !!(window as any).electronAPI;
    const fontsHref = isElectron ? "app://fonts.css" : "/fonts.css";

    // Check if fonts.css is already loaded
    const existing =
      document.querySelector(`link[href="${fontsHref}"]`) ||
      document.querySelector('link[href="/fonts.css"]') ||
      document.querySelector('link[href="app://fonts.css"]');
    if (existing) {
      return; // Already loaded
    }

    // Create and inject the link tag
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontsHref;
    link.type = "text/css";

    // Add to head
    const head =
      document.head ||
      document.querySelector("head") ||
      document.documentElement;
    head.appendChild(link);

    logger.category('ui').debug(`Web fonts stylesheet injected from ${fontsHref}`);
  } catch (error) {
    logger.category('ui').error("Failed to inject web fonts:", error);
  }
}
