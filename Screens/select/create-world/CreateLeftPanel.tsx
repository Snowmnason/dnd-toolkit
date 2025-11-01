import { Button, DescInput, Dropdown, Heading, SubTitle, TextInput } from '@/components/ui'
import { usePlatform } from '@/contexts/PlatformContext'
import { createWorldNameChangeHandler, isValidWorldNameForSubmission, type WorldNameValidationResult } from '@/lib'
import { useScale } from '@/theme'
import { useRouter } from 'expo-router'
import React from 'react'
import { ScrollView, View } from 'react-native'

interface CreateLeftPanelProps {
  worldName: string
  setWorldName: (name: string) => void
  worldNameValidation: WorldNameValidationResult | null
  setWorldNameValidation: (validation: WorldNameValidationResult | null) => void
  system: string
  setSystem: (system: string) => void
  systemItems: { label: string; value: string }[]
  description: string
  setDescription: (description: string) => void
  isCreating: boolean
  handleCreateWorld: () => void
}

export function CreateLeftPanel({
  worldName,
  setWorldName,
  worldNameValidation,
  setWorldNameValidation,
  system,
  setSystem,
  systemItems,
  description,
  setDescription,
  isCreating,
  handleCreateWorld,
}: CreateLeftPanelProps) {
  const S = useScale()
  const router = useRouter()
  
  // Centralized platform detection
  const { isDesktop } = usePlatform()

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: S.space.xxl * 2, // make room for bottom button
      }}
      showsVerticalScrollIndicator={false}
    >
      <Heading align="center" style={{ marginBottom: S.space.lg }}>
        Create New World
      </Heading>

      {/* World Name */}
      <View style={{ marginBottom: S.space.md }}>
        <TextInput
          heading="Name of World"
          placeholder="World Name"
          value={worldName}
          onChangeText={createWorldNameChangeHandler(
            setWorldName,
            setWorldNameValidation
          )}
        />

        {/* Validation errors */}
        {worldNameValidation && !worldNameValidation.isValid && (
          <View style={{}}>
            {worldNameValidation.errors.map((error, index) => (
              <SubTitle color="$danger" key={index}>
                ⚠️ {error}
              </SubTitle>
            ))}
          </View>
        )}
      </View>

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
      <DescInput
        heading="Description"
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{
          height: 300,
          textAlignVertical: 'top',
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
      <View
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
      </View>
    </ScrollView>
  )
}