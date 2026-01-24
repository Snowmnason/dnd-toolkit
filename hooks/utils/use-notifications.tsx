import { NotificationData } from '@/components/ui/Notification'
import React, { createContext, useCallback, useContext, useState } from 'react'

interface NotificationContextValue {
  notifications: NotificationData[]
  showNotification: (notification: Omit<NotificationData, 'id'>) => void
  dismissNotification: (id: string) => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

/**
 * 🔔 NotificationProvider
 * Manages notification queue and state
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const showNotification = useCallback((notification: Omit<NotificationData, 'id'>) => {
    const id = `notification-${Date.now()}-${Math.random()}`
    const newNotification: NotificationData = {
      ...notification,
      id,
      timestamp: notification.timestamp || new Date(),
      onDismiss: () => dismissNotification(id),
    }

    setNotifications(prev => {
      // Limit to max 3 visible notifications
      const updated = [newNotification, ...prev]
      return updated.slice(0, 3)
    })

    // Auto-dismiss after 5 seconds if not manually dismissed
    setTimeout(() => {
      dismissNotification(id)
    }, 5000)
  }, [dismissNotification])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{ notifications, showNotification, dismissNotification, clearAll }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

/**
 * 🪝 useNotifications
 * Hook to show/dismiss notifications from anywhere in the app
 */
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return context
}
