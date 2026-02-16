/**
 * AppToastLayer Component
 * Renders the global app-level toast at the root level
 * Mount this in app/_layout.tsx to display toasts app-wide
 */

import { useAppToast } from '@/lib/toast/app-toast-context'
import { AppToast } from './AppToast'

export function AppToastLayer() {
  const { toast, hide } = useAppToast()

  return (
    <AppToast
      message={toast.message}
      type={toast.type}
      visible={toast.visible}
      duration={toast.duration}
      onHide={hide}
    />
  )
}
