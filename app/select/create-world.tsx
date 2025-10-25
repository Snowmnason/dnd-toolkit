import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Platform, ScrollView } from 'react-native'

import { AppView, Body, Button, Dropdown, Heading, TextInput } from '@/components/ui'
import { useAuthStatus } from '@/hooks/use-auth-status'
import { useSuccessNavigation } from '@/hooks/use-success-navigation'
import { useWorldCreation } from '@/hooks/use-world-creation'
import { createWorldNameChangeHandler, isValidWorldNameForSubmission, type WorldNameValidationResult } from '@/lib'
import { $, useScale } from '@/theme'

import MapCanvas from '@/components/create-world/MapCanvas'
import { CreateWorldModals } from '@/components/modals'; // ✅ updated modal system

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
  // Platform detection
  const isDesktop =
    Platform.OS === 'web' || Platform.OS === 'windows' || Platform.OS === 'macos'

  // State
  const [worldName, setWorldName] = useState('')
  const [worldNameValidation, setWorldNameValidation] =
    useState<WorldNameValidationResult | null>(null)
  const [system, setSystem] = useState(tabletopSystems[0])
  const [description, setDescription] = useState('')
  const [imageImported, setImageImported] = useState(false)
  const [mapIndex, setMapIndex] = useState(
    Math.floor(Math.random() * defaultMapImages.length)
  )

  // Modal state
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Hooks
  const router = useRouter()
  const { isUserLoggedIn } = useAuthStatus()
  const { isCreating, successWorldName, successWorldId, createWorld } = useWorldCreation()
  const { navigateToWorld } = useSuccessNavigation({
    showSuccessModal,
    successWorldId,
  })

  // Logic
  const handleCreateWorld = async () => {
    if (!isValidWorldNameForSubmission(worldName)) {
      setShowValidationModal(true)
      return
    }

    if (!isUserLoggedIn) {
      setShowSignInModal(true)
      return
    }

    const result = await createWorld({
      name: worldName,
      description,
      system,
      mapImageUrl: defaultMapImages[mapIndex],
    })

    if (result.success) setShowSuccessModal(true)
  }

  const handleSuccessNavigate = () => {
    navigateToWorld()
  }

  // Panels
  const LeftPanel = (
      <AppView
        variant="page"
        style={{
          flex: 1,
          padding: S.space.lg,
          maxWidth: 700,
          alignSelf: 'center',
        }}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: S.space.xxl }}
      >
        <Heading align="center" style={{ marginBottom: S.space.lg }}>
          Create New World
        </Heading>

        {/* World Name */}
        <TextInput
          heading="Name of World"
          placeholder="World Name"
          value={worldName}
          onChangeText={createWorldNameChangeHandler(
            setWorldName,
            setWorldNameValidation
          )}
          style={{ marginBottom: S.space.md }}
        />

        {/* Validation errors */}
        {worldNameValidation && !worldNameValidation.isValid && (
          <AppView style={{ marginBottom: S.space.md }}>
            {worldNameValidation.errors.map((error, index) => (
              <Body key={index} color="$destructive" style={{ marginBottom: S.space.xs }}>
                ⚠️ {error}
              </Body>
            ))}
          </AppView>
        )}

        {/* Tabletop System */}
        <Dropdown
          heading="Tabletop System"
          value={system}
          items={systemItems}
          onChange={(value) => {
            if (value !== null) setSystem(value)
          }}
          placeholder="Select a tabletop system"
          style={{ marginBottom: S.space.md }}
        />

        {/* Description */}
        <TextInput
          heading="Description"
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{
            height: 100,
            textAlignVertical: 'top',
            marginBottom: S.space.lg,
          }}
        />

        {/* Import Image (mobile only) */}
        {!isDesktop && (
          <Button
            text="Import Image"
            variant="secondary"
            onPress={() => {}}
            style={{ marginBottom: S.space.lg }}
          />
        )}

        {/* Action Buttons */}
        <AppView
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: S.space.md,
          }}
        >
          <Button
            text="Cancel"
            variant="outlined"
            onPress={() => router.replace('/select/world-selection')}
            style={{ flex: 1, marginRight: S.space.sm }}
          />
          <Button
            text={isCreating ? 'Creating...' : 'Create'}
            variant="primary"
            onPress={handleCreateWorld}
            disabled={!isValidWorldNameForSubmission(worldName) || isCreating}
            style={{ flex: 1, marginLeft: S.space.sm }}
          />
        </AppView>
      </ScrollView>
    </AppView>
  )

  const RightPanel = isDesktop ? (
    <AppView
      style={{
        flex: 4,
        borderLeftWidth: 1,
        borderLeftColor: $('border'),
      }}
    >
      <MapCanvas
        onPress={() => {
          setImageImported(false)
          setMapIndex(Math.floor(Math.random() * defaultMapImages.length))
        }}
        imageImported={imageImported}
        imageUrl={defaultMapImages[mapIndex]}
      />
      <Button
        text="Import Image"
        variant="primary"
        onPress={() => setImageImported(true)}
        style={{ margin: S.space.lg }}
      />
    </AppView>
  ) : null

  return (
    <AppView
      variant="page"
      style={{
        flex: 1,
        flexDirection: isDesktop ? 'row' : 'column',
      }}
    >
      {LeftPanel}
      {RightPanel}

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
    </AppView>
  )
}
