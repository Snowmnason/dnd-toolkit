import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { View } from 'react-native'

import { CreateWorldModals } from '@/components/modals'
import { AppSplit, Button } from '@/components/ui'
import { usePlatform } from '@/contexts/PlatformContext'
import { useAuthStatus } from '@/hooks/use-auth-status'
import { useSuccessNavigation } from '@/hooks/use-success-navigation'
import { useWorldCreation } from '@/hooks/use-world-creation'
import { worldSchema, type WorldFormData } from '@/lib/schemas'
import { CreateLeftPanel } from '@/Screens/select/create-world/CreateLeftPanel'
import MapCanvas from '@/Screens/select/create-world/MapCanvas'
import { useScale } from '@/theme'

// Constants
const tabletopSystems = ['D&D 5e', 'Pathfinder', 'Call of Cthulhu', 'Custom']
const systemItems = tabletopSystems.map((t) => ({ label: t, value: t }))

/**
 * Default map images
 * NOTE: External URLs require CORS headers. For production:
 * 1. Download images and store in assets/images/
 * 2. Use local paths instead of external URLs
 * 3. Or use your backend as an image proxy
 * 
 * Currently empty - maps can be uploaded via the import feature
 */
const defaultMapImages: string[] = []

export default function CreateWorldScreen() {
  const S = useScale()
  
  // Centralized platform detection
  const { isDesktop } = usePlatform()

  // RHF form
  const { control, handleSubmit, formState: { isValid } } = useForm<WorldFormData>({
    resolver: zodResolver(worldSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      system: tabletopSystems[0] as WorldFormData['system'],
    },
  })
  // Local state
  const [imageImported, setImageImported] = useState(false)
  const [mapIndex, setMapIndex] = useState(0)

  // Modal state
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Hooks
  const { isUserLoggedIn } = useAuthStatus()
  const { isCreating, successWorldName, successWorldId, createWorld } = useWorldCreation()
  const { navigateToWorld } = useSuccessNavigation({
    showSuccessModal,
    successWorldId,
  })

  // Logic
  const onSubmit = async (data: WorldFormData) => {
    if (!isUserLoggedIn) {
      setShowSignInModal(true)
      return
    }

    const result = await createWorld({
      name: data.name,
      description: data.description || '',
      system: data.system,
      // Use map image if available, otherwise empty string
      // eslint-disable-next-line security/detect-object-injection
      mapImageUrl: defaultMapImages.length > 0 ? defaultMapImages[mapIndex] : undefined,
    })

    if (result.success) setShowSuccessModal(true)
  }

  const handleSuccessNavigate = () => {
    navigateToWorld()
  }

  // Left Panel Component
  const LeftPanel = (
    <CreateLeftPanel
      control={control}
      systemItems={systemItems}
      isCreating={isCreating}
      isFormValid={isValid}
      handleCreateWorld={handleSubmit(onSubmit, () => setShowValidationModal(true))}
    />
  )

  // Right Panel Component
  const RightPanel = isDesktop ? (
    <View
      style={{
        flex: 3,
      }}
    >
      <MapCanvas
        onPress={() => {
          setImageImported(false)
          if (defaultMapImages.length > 0) {
            setMapIndex(Math.floor(Math.random() * defaultMapImages.length))
          }
        }}
        imageImported={imageImported}
        // Use map image if available
        // eslint-disable-next-line security/detect-object-injection
        imageUrl={defaultMapImages.length > 0 ? defaultMapImages[mapIndex] : undefined}
      />
      <Button
        text="Import Image"
        variant="primary"
        onPress={() => setImageImported(true)}
        style={{ margin: S.space.lg }}
      />
    </View>
  ) : null

  return (
    <AppSplit left={LeftPanel} right={RightPanel}>
      {/* Modals */}
      <CreateWorldModals
        showSignInModal={showSignInModal}
        setShowSignInModal={setShowSignInModal}
        showValidationModal={showValidationModal}
        setShowValidationModal={setShowValidationModal}
        showSuccessModal={showSuccessModal}
        setShowSuccessModal={setShowSuccessModal}
        successWorldName={successWorldName}
        onSuccessNavigate={handleSuccessNavigate}
      />
    </AppSplit>
  )
}
