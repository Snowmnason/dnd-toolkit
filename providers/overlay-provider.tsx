import '@/components/modals/register-all-modals'
import React from 'react'
import { AppSnackbarProvider } from '../contexts/app-snackbar-context'
import { AppToastProvider } from '../contexts/app-toast-context'
import { ChromeProvider } from '../contexts/chrome-context'
import { ModalProvider } from '../contexts/modal-context'
import { NavDrawerProvider } from '../contexts/nav-drawer-context'
import { NotificationProvider } from '../contexts/notifications-context'
import { DropdownPortalProvider } from './DropdownPortalProvider'
import { JobOperationProvider } from './JobOperationProvider'
import { TooltipPortalProvider } from './TooltipPortalProvider'

/**
 * 🔔 OverlayProvider
 * Composite provider that groups all overlay/notification + chrome contexts.
 *
 * Order matters (outermost → innermost / highest z-index → lowest):
 * - ModalProvider ............. z-index: 1000+ (above everything)
 * - TooltipPortalProvider ..... z-index: 9000  (above NavDraw so tooltips on drawer items work)
 * - DropdownPortalProvider .... z-index: 8500  (above content, below tooltips & modals)
 * - NavDrawerProvider ......... z-index: 800+
 * - NotificationProvider ...... z-index: 700+
 * - AppToastProvider .......... z-index: 600+
 * - AppSnackbarProvider ....... z-index: 500+
 * - JobOperationProvider ...... z-index: 400+
 * - ChromeProvider ............ (TopBar/BottomBar state — no z-index)
 *
 * ✅ Gate-Free: None of these depend on kernel phases.
 */
export function OverlayProvider({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <TooltipPortalProvider>
        <DropdownPortalProvider>
          <NavDrawerProvider>
            <NotificationProvider>
              <AppToastProvider>
                <AppSnackbarProvider>
                  <JobOperationProvider>
                    <ChromeProvider>
                      {children}
                    </ChromeProvider>
                  </JobOperationProvider>
                </AppSnackbarProvider>
              </AppToastProvider>
            </NotificationProvider>
          </NavDrawerProvider>
        </DropdownPortalProvider>
      </TooltipPortalProvider>
    </ModalProvider>
  )
}
