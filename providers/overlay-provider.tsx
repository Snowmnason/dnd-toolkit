import React from 'react'
import { AppSnackbarProvider } from '../contexts/app-snackbar-context'
import { AppToastProvider } from '../contexts/app-toast-context'
import { ChromeProvider } from '../contexts/chrome-context'
import { ModalProvider } from '../contexts/modal-context'
import { NavDrawerProvider } from '../contexts/nav-drawer-context'
import { NotificationProvider } from '../contexts/notifications-context'

/**
 * 🔔 OverlayProvider
 * Composite provider that groups all overlay/notification + chrome contexts:
 * ModalProvider → NavDrawerProvider → NotificationProvider → AppToastProvider → AppSnackbarProvider → ChromeProvider
 *
 * Order matters:
 * - Modal is outermost (overlays appear above everything)
 * - Notifications next
 * - Toast and Snackbar innermost (appear above chrome elements)
 * - ChromeProvider innermost (provides state for TopBar + BottomBar)
 *   Overlays render on top of chrome because they're rendered by outer providers
 *
 * ✅ Gate-Free: None of these depend on kernel phases.
 */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <NavDrawerProvider>
        <NotificationProvider>
          <AppToastProvider>
            <AppSnackbarProvider>
              <ChromeProvider>
                {children}
              </ChromeProvider>
            </AppSnackbarProvider>
          </AppToastProvider>
        </NotificationProvider>
      </NavDrawerProvider>
    </ModalProvider>
  )
}
