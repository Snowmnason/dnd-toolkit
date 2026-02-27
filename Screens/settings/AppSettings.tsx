import { Button, SubTitle, Switch } from '@/components/ui'
import { useAnalyticsConsent, useForceResync, useNetworkStatus, useRefreshStorageCache } from '@/hooks'
import { useScale } from '@/theme'
import { View } from 'react-native'

/**
 * ⚙️ AppSettings
 * Displays app settings with button groups for future features.
 * 
 * Force Refresh: Fetches latest user data from server, bypassing the 4-hour cache
 * Force Resync: Triggers offline queue sync if mutations are pending
 * Analytics Consent: Toggle between basic (GDPR-safe minimum) and full tracking
 * Toasts are displayed globally via AppToastLayer at app root.
 */
export function AppSettings() {
  const S = useScale()
  const { isOnline } = useNetworkStatus()
  const isOffline = !isOnline

  const { isResyncing, handleForceResync } = useForceResync({ isOffline })

  const { isRefreshing, handleRefreshStorageCache } = useRefreshStorageCache({ isOffline })

  const { level: consentLevel, setLevel: setConsentLevel, isLoading: consentLoading } = useAnalyticsConsent()

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

      {/* Row 2: Analytics Consent Toggle */}
      <View style={{ flexDirection: 'row', gap: S.space.sm }}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
        <Switch
          heading="Analytics Consent"
          checked={consentLevel === 'full'}
          onChange={(isFullConsent) => {
            const newLevel = isFullConsent ? 'full' : 'basic'
            void setConsentLevel(newLevel).catch((error) => {
              // Silently log errors; toast shown by useAnalyticsConsent hook if needed
              console.error('[Analytics] Failed to set consent level:', error)
            })
          }}
          disabled={consentLoading}
          leftLabel="Basic"
          rightLabel="Full"
        />
        <SubTitle textType='primary' style={{ marginLeft: S.space.md }}>
          {consentLevel === 'full'
            ? 'Full tracking: analytics enabled'
            : 'Basic tracking: GDPR-safe minimum only'}
        </SubTitle>
        </View>
        <Button
          text="Setting 4"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
      </View>

      {/* Row 3: Placeholder buttons */}
      <View style={{ flexDirection: 'row', gap: S.space.sm }}>
        <Button
          text="Setting 4"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
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