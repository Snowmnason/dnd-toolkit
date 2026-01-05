import { usePlatform } from '@/contexts/PlatformContext'
import { useState } from 'react'
import { Platform } from 'react-native'

interface UsePanelNavigationOptions {
  onPanelChange?: (panel: 'left' | 'right') => void
  onBackPress?: () => boolean // Return true if back was handled
}

/**
 * Hook to manage left/right panel navigation for mobile layouts.
 * Handles panel switching, back navigation, and will support gestures/hardware back in the future.
 * 
 * TODO: Integrate with top bar back button override
 * TODO: Add hardware back button support (Android)
 * TODO: Add swipe gesture support (iOS/Android only)
 * TODO: Add panel transition animations
 */
export function usePanelNavigation(options?: UsePanelNavigationOptions) {
  const { isDesktop } = usePlatform()
  const [activePanel, setActivePanel] = useState<'left' | 'right'>('left')

  // Check if we're on actual mobile device (not just small screen)
  const isActualMobile = Platform.OS === 'ios' || Platform.OS === 'android'

  const showLeftPanel = isDesktop || activePanel === 'left'
  const showRightPanel = isDesktop || activePanel === 'right'

  const goToRightPanel = () => {
    if (!isDesktop) {
      setActivePanel('right')
      options?.onPanelChange?.('right')
    }
  }

  const goToLeftPanel = () => {
    if (!isDesktop) {
      setActivePanel('left')
      options?.onPanelChange?.('left')
    }
  }

  // Handle back button press (from top bar, hardware, or gesture)
  const handleBackPress = (): boolean => {
    // If on right panel and not desktop, go back to left panel
    if (!isDesktop && activePanel === 'right') {
      goToLeftPanel()
      return true // Indicates back was handled
    }
    
    // Otherwise, let default back behavior happen
    return false
  }

  // TODO: Add hardware back button listener here when navigation overhaul happens
  // useEffect(() => {
  //   if (isActualMobile) {
  //     const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress)
  //     return () => backHandler.remove()
  //   }
  // }, [activePanel, isActualMobile])

  // TODO: Add swipe gesture recognizer here
  // const panGestureHandler = useMemo(() => {
  //   if (isActualMobile) {
  //     return Gesture.Pan()
  //       .onEnd((e) => {
  //         if (e.translationX > 50 && activePanel === 'right') {
  //           goToLeftPanel()
  //         }
  //       })
  //   }
  // }, [activePanel, isActualMobile])

  return {
    activePanel,
    showLeftPanel,
    showRightPanel,
    goToRightPanel,
    goToLeftPanel,
    handleBackPress, // Expose this for top bar integration
    isDesktop,
    isActualMobile,
  }
}
