import { Notification } from '@/components/ui/Notification'
import { useNotifications } from '@/hooks/use-notifications'
import { memo, useEffect } from 'react'

/**
 * 📢 NotificationContainer
 * Renders all active notifications from the queue.
 * 
 * KEY: Only wraps the notifications themselves, NOT a full-screen container.
 * This prevents the invisible box from blocking user interactions.
 * Notifications are positioned absolutely but don't create a blocking overlay.
 */
function NotificationContainerInner() {
  const { notifications } = useNotifications()

  useEffect(() => {
    console.log(`[NotificationContainer] Mount`)
    return () => console.log(`[NotificationContainer] Unmount`)
  }, [])

  useEffect(() => {
    console.log(`[NotificationContainer] Notifications updated:`, notifications.length, notifications.map(n => n.id))
  }, [notifications])

  console.log(`[NotificationContainer] Rendering with ${notifications.length} notifications`)

  // Only return notifications - no full-screen wrapper
  // Each notification handles its own positioning and pointer events
  return (
    <>
      {notifications.map((notification, index) => (
        <Notification
          key={notification.id}
          {...notification}
          visible={true}
          index={index}
        />
      ))}
    </>
  )
}

// Export memoized version to prevent re-renders from parent
export const NotificationContainer = memo(NotificationContainerInner)
