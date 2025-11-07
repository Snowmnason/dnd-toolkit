import { Notification } from '@/components/ui/Notification'
import { useNotifications } from '@/hooks/use-notifications'
import React from 'react'
import { View } from 'react-native'

/**
 * 📢 NotificationContainer
 * Renders all active notifications from the queue
 * Place this at the root of your app (in _layout or App.tsx)
 */
export function NotificationContainer() {
  const { notifications } = useNotifications()

  return (
    <View style={{ pointerEvents: 'box-none' }}>
      {notifications.map((notification, index) => (
        <Notification
          key={notification.id}
          {...notification}
          visible={true}
          index={index}
        />
      ))}
    </View>
  )
}
