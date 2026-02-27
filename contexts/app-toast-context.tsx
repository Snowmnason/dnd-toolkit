import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type ToastType = 'info' | 'success' | 'error' | 'warning'

export interface AppToastState {
  visible: boolean
  message: string
  type: ToastType
  duration: number
}

interface ToastItem {
  id: string
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
 * Manages global AppToast state with a queue system for displaying toasts sequentially.
 * Multiple toast requests are queued and displayed one at a time, preventing message loss.
 */
export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<AppToastState>({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
  })

  const [toastQueue, setToastQueue] = useState<ToastItem[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastIdRef = useRef(0)

  // Process queue when it changes or when current toast is hidden
  useEffect(() => {
    if (!toast.visible && toastQueue.length > 0) {
      // Show next toast in queue
      const nextToast = toastQueue[0]
      setToast({
        visible: true,
        message: nextToast.message,
        type: nextToast.type,
        duration: nextToast.duration,
      })

      // Remove from queue
      setToastQueue(prev => prev.slice(1))

      // Schedule auto-hide
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setToast(prev => ({
          ...prev,
          visible: false,
        }))
      }, nextToast.duration)
    }
  }, [toast.visible, toastQueue])

  const show = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const toastItem: ToastItem = {
      id: `toast-${++toastIdRef.current}`,
      message,
      type,
      duration,
    }

    setToastQueue(prev => [...prev, toastItem])
  }, [])

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
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
