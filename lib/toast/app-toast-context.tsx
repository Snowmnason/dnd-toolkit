import React, { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface AppToastState {
  visible: boolean
  message: string
  type: ToastType
  duration: number
}

interface AppToastContextValue {
  toast: AppToastState
  show: (message: string, type?: ToastType, duration?: number) => void
  hide: () => void
}

const AppToastContext = createContext<AppToastContextValue | undefined>(undefined)

/**
 * 🍞 AppToastProvider
 * Manages global AppToast state for displaying transient notifications at app root
 */
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<AppToastState>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  })

  const show = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    setToast({
      visible: true,
      message,
      type,
      duration,
    })
  }, [])

  const hide = useCallback(() => {
    setToast(prev => ({
      ...prev,
      visible: false,
    }))
  }, [])

  return (
    <AppToastContext.Provider value={{ toast, show, hide }}>
      {children}
    </AppToastContext.Provider>
  )
}

/**
 * 🪝 useAppToast
 * Hook to show/dismiss app-level toasts from anywhere in the app
 */
export function useAppToast() {
  const context = useContext(AppToastContext)
  if (!context) {
    throw new Error('useAppToast must be used within AppToastProvider')
  }
  return context
}
