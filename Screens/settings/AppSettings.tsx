import { Button, SubTitle } from '@/components/ui'
import { logger } from '@/lib'
import { getCurrentUserProfile } from '@/lib/database/common'
import { useScale } from '@/theme'
import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'

interface AppSettingsProps {
  setSyncingToast: (visible: boolean) => void
  setSuccessToast: (visible: boolean) => void
  setErrorToast: (visible: boolean) => void
  setErrorMessage: (message: string) => void
}

/**
 * ⚙️ AppSettings
 * Displays app settings with button groups for future features.
 * 
 * Force Refresh: Fetches latest user data from server, bypassing the 4-hour cache
 */
export function AppSettings({
  setSyncingToast,
  setSuccessToast,
  setErrorToast,
  setErrorMessage,
}: AppSettingsProps) {
  const S = useScale()
  const [refreshDisabled, setRefreshDisabled] = useState(false)
  
  // Track component mount status to prevent state updates on unmounted component
  const isMountedRef = useRef(true)
  
  // TODO: Replace with actual offline check when offline functionality is implemented
  const isOffline = false

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleForceRefresh = async () => {
    if (refreshDisabled || isOffline) return

    setRefreshDisabled(true)
    setSyncingToast(true)
    const startTime = Date.now()

    try {
      // Force refresh bypasses 4-hour cache, fetches latest from server
      await getCurrentUserProfile(true)
      logger.info('AppSettings', 'Force refresh completed successfully')
      
      // Keep syncing toast visible for at least 2 seconds before showing success
      const elapsedTime = Date.now() - startTime
      const minDisplayTime = 2000
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime)
      
      setTimeout(() => {
        if (isMountedRef.current) {
          setSyncingToast(false)
          setSuccessToast(true)
        }
      }, remainingTime)
    } catch (error: any) {
      logger.error('AppSettings', 'Force refresh failed:', error)
      setErrorMessage('Failed to sync data. Please try again.')
      setSyncingToast(false)
      setErrorToast(true)
    } finally {
      // Prevent accidental excessive refreshes
      setTimeout(() => {
        if (isMountedRef.current) {
          setRefreshDisabled(false)
        }
      }, 1500)
    }
  }

  return (
    <View style={{ gap: S.space.md }}>
      {/* Row 1: Force Refresh Button */}
      <View style={{ flexDirection: 'row', gap: S.space.sm }}>
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <Button
            text="Refresh App Data"
            variant="secondary"
            onPress={handleForceRefresh}
            disabled={refreshDisabled || isOffline}
            style={{ flex: 1 }}
          />
          <SubTitle textType='primary' style={{ marginTop: S.space.xs, marginLeft: S.space.md }}>
            Syncs your latest changes from the server
          </SubTitle>
        </View>
        <Button
          text="Setting 2"
          variant="secondary"
          onPress={() => {}}
          style={{ flex: 1 }}
        />
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