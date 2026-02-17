import { Button, SubTitle } from '@/components/ui'
import { useForceResync, useRefreshStorageCache } from '@/hooks'
import { useNetworkStatus } from '@/lib/network'
import { useScale } from '@/theme'
import { View } from 'react-native'

/**
 * ⚙️ AppSettings
 * Displays app settings with button groups for future features.
 * 
 * Force Refresh: Fetches latest user data from server, bypassing the 4-hour cache
 * Force Resync: Triggers offline queue sync if mutations are pending
 * Toasts are displayed globally via AppToastLayer at app root.
 */
export function AppSettings() {
  const S = useScale()
  const { isOnline } = useNetworkStatus()
  const isOffline = !isOnline

  const { isResyncing, handleForceResync } = useForceResync({ isOffline })

  const { isRefreshing, handleRefreshStorageCache } = useRefreshStorageCache({ isOffline })

  return (
    <View style={{ gap: S.space.md }}>
      {/* Row 1: Force Refresh Button */}
      <View style={{ flexDirection: 'row', gap: S.space.sm }}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <Button
            text={isRefreshing ? 'Refreshing...' : 'Refresh App Data'}
            variant="secondary"
            onPress={handleRefreshStorageCache}
            disabled={isRefreshing || isOffline}
            style={{ flex: 1 }}
          />
          <SubTitle textType='primary' style={{ marginTop: S.space.xs, marginLeft: S.space.md }}>
            Syncs your latest changes from the server
          </SubTitle>
        </View>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <Button
            text={isResyncing ? 'Resyncing...' : 'Force Resync'}
            variant="secondary"
            onPress={handleForceResync}
            disabled={isResyncing || isOffline}
            style={{ flex: 1 }}
          />
          <SubTitle textType='primary' style={{ marginTop: S.space.xs, marginLeft: S.space.md }}>
            Force a background sync of pending offline changes
          </SubTitle>
        </View>
      </View>

      {/* Row 2: Placeholder buttons */}
      <View style={{ flexDirection: 'row', gap: S.space.sm }}>
        <Button
          text="Setting 3"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
        <Button
          text="Setting 4"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
      </View>

      {/* Row 3: Single button for now */}
      <View style={{ flexDirection: 'row' }}>
        <Button
          text="Setting 5"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  )
}