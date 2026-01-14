/**
 * 🔤 Web Font Injection Utility
 * Loads fonts.css on web to make custom fonts available
 */

export async function injectWebFonts(): Promise<void> {
  if (typeof document === 'undefined') {
    return; // Not running on web
  }

  try {
    // Check if fonts.css is already loaded
    const existing = document.querySelector('link[href="/fonts.css"]');
    if (existing) {
      return; // Already loaded
    }

    // Create and inject the link tag
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/fonts.css';
    link.type = 'text/css';
    
    // Add to head
    const head = document.head || document.querySelector('head') || document.documentElement;
    head.appendChild(link);
    
    console.log('✅ Web fonts stylesheet injected');
  } catch (error) {
    console.error('❌ Failed to inject web fonts:', error);
  }
}
