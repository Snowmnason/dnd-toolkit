import React from 'react'
import { AppSnackbarProvider } from './app-snackbar-context'
import { AppToastProvider } from './app-toast-context'
import { ModalProvider } from './modal-context'
import { NavDrawerProvider } from './nav-drawer-context'
import { NotificationProvider } from './notifications-context'

/**
 * 🔔 OverlayProvider
 * Composite provider that groups all overlay/notification contexts:
 * ModalProvider → NotificationProvider → AppToastProvider → AppSnackbarProvider
 *
 * Order matters: Modal is outermost (toasts/snackbars can show inside modals),
 * notifications next, then toast and snackbar innermost.
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
              {children}
            </AppSnackbarProvider>
          </AppToastProvider>
        </NotificationProvider>
      </NavDrawerProvider>
    </ModalProvider>
  )
}
