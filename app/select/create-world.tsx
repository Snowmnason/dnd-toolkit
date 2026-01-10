import { useState } from 'react'
import { View } from 'react-native'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

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
const defaultMapImages = [
  'https://media.wizards.com/2015/images/dnd/resources/Sword-Coast-Map_MedRes.jpg',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJm47wbufqY9yqRw_OLFJBtLEYYNGlCMMHWRozByIB4-SvH-6lwXPEI7L4LXhA1la-Ek0w7L_TU1wBkX4P7Z4fKmVQ2XAHuAmiF-4HYOGKWAZofbqc0e3pNca2dvU4HAWDuh8bg4y869M/s1600/Vlaroa1.jpg',
  'https://talaraska.com/wp-content/uploads/2024/01/text-1-hw-terrain-4275x2600-1.jpg',
  'https://images.squarespace-cdn.com/content/v1/5dadaf88e03a4e6bb69307dd/904f0cc0-7846-4576-ac91-176528727e4b/Vhaledhon+No+Text+Map+Blog.jpg',
]

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
  const [mapIndex, setMapIndex] = useState(
    Math.floor(Math.random() * defaultMapImages.length)
  )

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
      // Safely access array with bounds checking
      mapImageUrl: defaultMapImages[Math.max(0, Math.min(mapIndex, defaultMapImages.length - 1))],
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
          setMapIndex(Math.floor(Math.random() * defaultMapImages.length))
        }}
        imageImported={imageImported}
        // Safely access array with bounds checking
        imageUrl={defaultMapImages[Math.max(0, Math.min(mapIndex, defaultMapImages.length - 1))]}
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
