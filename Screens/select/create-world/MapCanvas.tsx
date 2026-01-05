import { Button, ToggleGroup } from '@/components/ui'
import { useScale } from '@/theme'
import React, { useState } from 'react'
import { Image, Text, View } from 'react-native'

interface MapCanvasProps {
  onPress: () => void
  imageImported?: boolean
  imageUrl?: string
  onToolSelect?: (tool: string) => void
  onMapEdit?: (changes: any) => void
}

/**
 * 🗺️ MapCanvas (Desktop Only)
 * Layout + toolbar for map creation/editing.
 * Uses ToggleGroup for tool selection; drawing logic to come later.
 */
export default function MapCanvas({
  onPress,
  imageImported = false,
  imageUrl,
  onToolSelect,
}: MapCanvasProps) {
  const S = useScale()
  const [selectedTool, setSelectedTool] = useState<string | null>(null)

  const tools = [
  { key: 'pen', label: 'Draw', value: 'pen', icon: '🖊️' },
  { key: 'brush', label: 'Paint', value: 'brush', icon: '🖌️' },
  { key: 'marker', label: 'Mark', value: 'marker', icon: '📍' },
  { key: 'image', label: 'Import', value: 'image', icon: '🖼️' },
]

  const handleToolSelect = (tool: string) => {
    setSelectedTool(tool)
    onToolSelect?.(tool)
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1A1A1A', // dark gray canvas background
        position: 'relative',
        borderRadius: S.radius.lg,
        overflow: 'hidden',
      }}
    >
      {/* Exit button */}
      <View
        style={{
          position: 'absolute',
          top: S.space.md,
          left: S.space.md,
          zIndex: 5,
        }}
      >
        <Button
          text="×"
          variant="secondary"
          onPress={onPress}
          style={{
            width: 44,
            height: 44,
            borderRadius: S.radius.round,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        />
      </View>

      {/* Canvas area */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: S.space.lg,
        }}
      >
        {!imageImported ? (
          <>
            <Text
              style={{
                color: '#B0B0B0',
                fontSize: 16,
                textAlign: 'center',
                marginBottom: S.space.sm,
              }}
            >
              {selectedTool
                ? `${tools.find((t) => t.value === selectedTool)?.label} Selected`
                : '🗺️ [Map Canvas Area]'}
            </Text>
            {selectedTool && (
              <Text
                style={{
                  color: '#888',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Tap or click to start{' '}
                {selectedTool === 'marker'
                  ? 'placing markers'
                  : selectedTool === 'pen'
                  ? 'drawing'
                  : selectedTool === 'brush'
                  ? 'painting'
                  : 'importing an image'}
              </Text>
            )}
          </>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={{
              flex: 1,
              borderRadius: S.radius.md,
              width: '100%',
              height: '100%',
            }}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Bottom Toolbar */}
      <View
        style={{
          position: 'absolute',
          bottom: S.space.lg,
          left: S.space.lg,
          right: S.space.lg,
          backgroundColor: 'rgba(40, 40, 40, 0.9)',
          borderRadius: S.radius.lg,
          paddingVertical: S.space.sm,
          paddingHorizontal: S.space.md,
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }}
      >
        <ToggleGroup
          items={tools}
          active={selectedTool ? [selectedTool] : []}   // ✅ array of active keys
          onChange={(keys) => handleToolSelect(keys[0] || '')}  // ✅ pick first
          direction="horizontal"
          //fullWidth
        />
      </View>
    </View>
  )
}
