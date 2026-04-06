import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export type SnackbarTone = 'info' | 'success' | 'error' | 'warning'

export interface AppSnackbarState {
  visible: boolean
  message: string
  tone: SnackbarTone
  duration: number
  actionText?: string
  onAction?: () => void
}

interface SnackbarItem {
  id: string
  message: string
  tone: SnackbarTone
  duration: number
  actionText?: string
  onAction?: () => void
}

interface AppSnackbarContextValue {
  snackbar: AppSnackbarState
  show: (message: string, options?: {
    tone?: SnackbarTone
    duration?: number
    actionText?: string
    onAction?: () => void
  }) => void
  hide: () => void
}

const AppSnackbarContext = createContext<AppSnackbarContextValue | undefined>(undefined)

/**
 * 🍫 AppSnackbarProvider
 * Manages global SnackBar state with a queue system for displaying snackbars sequentially.
 * Multiple snackbar requests are queued and displayed one at a time, preventing message loss.
 * 
 * ✅ Gate-Free: Does not depend on kernel phases.
 * Only manages UI snackbar queue state with React hooks and timeouts.
 */
export function AppSnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snackbar, setSnackbar] = useState<AppSnackbarState>({
    visible: false,
    message: '',
    tone: 'info',
    duration: 4000,
  })

  const [queue, setQueue] = useState<SnackbarItem[]>([])
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snackbarIdRef = useRef(0)

  // Process queue when it changes or when current snackbar is hidden
  useEffect(() => {
    if (!snackbar.visible && queue.length > 0) {
      const next = queue[0]
      setSnackbar({
        visible: true,
        message: next.message,
        tone: next.tone,
        duration: next.duration,
        actionText: next.actionText,
        onAction: next.onAction,
      })

      setQueue(prev => prev.slice(1))

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setSnackbar(prev => ({ ...prev, visible: false }))
      }, next.duration)
    }
  }, [snackbar.visible, queue])

  const show = useCallback((message: string, options?: {
    tone?: SnackbarTone
    duration?: number
    actionText?: string
    onAction?: () => void
  }) => {
    const item: SnackbarItem = {
      id: `snackbar-${++snackbarIdRef.current}`,
      message,
      tone: options?.tone ?? 'info',
      duration: options?.duration ?? 4000,
      actionText: options?.actionText,
      onAction: options?.onAction,
    }
    setQueue(prev => [...prev, item])
  }, [])

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setSnackbar(prev => ({ ...prev, visible: false }))
  }, [])

  return (
    <AppSnackbarContext.Provider value={{ snackbar, show, hide }}>
      {children}
    </AppSnackbarContext.Provider>
  )
}

/**
 * 🪝 useAppSnackbar
 * Hook to show/dismiss app-level snackbars from anywhere in the app
 */
export function useAppSnackbar() {
  const context = useContext(AppSnackbarContext)
  if (!context) {
    throw new Error('useAppSnackbar must be used within AppSnackbarProvider')
  }
  return context
}
