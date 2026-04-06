/**
 * Toast Adapter — Bridge between degradation handlers and centralized AppToastContext
 *
 * Converts DegradeToastOptions into AppToastContext format.
 * The actual show() function is injected during bootstrap from AppToastContext.
 *
 * Pattern:
 * 1. In app/_layout.tsx: call `useInjectToastSystem()` after AppToastProvider
 * 2. This injects the AppToastContext.show() function into this adapter
 * 3. At runtime: degradation handlers call showDegradeToast(options)
 * 4. Toast adapter delegates to centralized toast system
 *
 * This keeps lib/error layers decoupled from React hooks while leveraging
 * the existing centralized toast queue system.
 *
 * Usage in app/_layout.tsx:
 * ```tsx
 * import { useInjectToastSystem } from '@/hooks/utils';
 *
 * export default function RootLayout() {
 *   useInjectToastSystem();  // ← Inject toast system (after AppToastProvider)
 *   return <AppContent />;
 * }
 * ```
 */

import type { ToastType } from '@/contexts/app-toast-context';
import type { DegradeToastOptions } from '@/type-definitions/degrade';

// Injected at bootstrap — the actual show() function from AppToastContext
let toastShowFunction: ((title: string, message: string, type?: ToastType, duration?: number) => void) | null = null;

/**
 * Inject the centralized toast show() function at bootstrap
 * Called from registration-phase with the actual AppToastContext.show
 */
export function injectToastShowFunction(
  showFunction: (title: string, message: string, type?: ToastType, duration?: number) => void,
): void {
  toastShowFunction = showFunction;
}

/**
 * Show a toast from a degradation event
 * Converts DegradeToastOptions to AppToastContext format and delegates to centralized system
 */
export function showDegradeToast(options: DegradeToastOptions): void {
  if (!toastShowFunction) {
    // Fallback if toast system not initialized
    console.warn('[ToastAdapter] Toast system not initialized, message not shown:', options.title);
    return;
  }

  try {
    // Map severity to toast type
    const type: ToastType = (options.severity as ToastType) || 'info';
    // Prefer message field (detailed), fall back to title
    const message = options.message || options.title || 'Notification';
    // Use provided duration or default
    const duration = options.duration ?? 3000;
    // Use title field for toast title, fall back to severity
    const title = options.title || type.charAt(0).toUpperCase() + type.slice(1);

    toastShowFunction(title, message, type, duration);
  } catch (error) {
    console.error('[ToastAdapter] Error showing toast:', error, options);
  }
}
