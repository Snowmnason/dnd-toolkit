import IconButton from '@/components/custom_components/IconButton';
import { CoreColors } from '@/constants/corecolors';
import { BorderRadius, Spacing } from '@/constants/theme';
import React, { useState } from 'react';
import { Image, ImageStyle, Text, TextStyle, View, ViewStyle } from 'react-native';

interface MapCanvasProps {
  onPress: () => void;
  imageImported?: boolean;
  imageUrl?: string;
  onToolSelect?: (tool: string) => void;
  onMapEdit?: (changes: any) => void;
}

interface ToolButton {
  icon: string;
  key: string;
  label: string;
}

// TODO: Uncomment when map editing functionality is implemented
// interface MapData {
//   markers: any[];
//   paths: any[];
//   notes: any[];
// }

export default function MapCanvas({ 
  onPress, 
  imageImported = false, 
  imageUrl,
  onToolSelect,
  onMapEdit
}: MapCanvasProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  
  // TODO: Implement map data state when editing functionality is added
  // const [mapData, setMapData] = useState<MapData>({
  //   markers: [],
  //   paths: [],
  //   notes: []
  // });

  const tools: ToolButton[] = [
    { icon: '🖊️', key: 'pen', label: 'Draw' },
    { icon: '🖌️', key: 'brush', label: 'Paint' },
    { icon: '📍', key: 'marker', label: 'Mark' },
    { icon: '🖼️', key: 'image', label: 'Import' },
  ];

  const handleToolSelect = (toolKey: string) => {
    setSelectedTool(toolKey);
    onToolSelect?.(toolKey);
  };

  // TODO: Implement map editing functionality
  // const handleMapChange = (changes: Partial<MapData>) => {
  //   const newMapData = { ...mapData, ...changes };
  //   setMapData(newMapData);
  //   onMapEdit?.(newMapData);
  // };

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: CoreColors.backgroundDark,
    position: 'relative',
  };

  const closeButtonStyle: ViewStyle = {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: CoreColors.backgroundAccent,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    zIndex: 5,
  };

  const canvasAreaStyle: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const placeholderTextStyle: TextStyle = {
    color: CoreColors.textSecondary,
    fontSize: 16,
  };

  const imageStyle: ImageStyle = {
    flex: 1,
    margin: Spacing.md,
    borderRadius: BorderRadius.sm,
  };

  const toolbarStyle: ViewStyle = {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: CoreColors.backgroundAccent,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.md,
  };

  const getToolButtonStyle = (toolKey: string): ViewStyle => ({
    backgroundColor: selectedTool === toolKey ? CoreColors.primary : 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 44,
    alignItems: 'center',
  });

  const getToolTextStyle = (toolKey: string): TextStyle => ({
    color: selectedTool === toolKey ? CoreColors.textPrimary : CoreColors.textSecondary,
    fontSize: 20,
  });

  return (
    <View style={containerStyle}>
      <IconButton 
        icon="❌"
        onPress={onPress}
        style={closeButtonStyle}
      />
      
      {/* Canvas area */}
      {!imageImported ? (
        <View style={canvasAreaStyle}>
          <Text style={placeholderTextStyle}>
            {selectedTool ? `${tools.find(t => t.key === selectedTool)?.label} Tool Selected` : '[Map Canvas Area]'}
          </Text>
          {selectedTool && (
            <Text style={[placeholderTextStyle, { marginTop: Spacing.sm, fontSize: 14 }]}>
              Tap to start {selectedTool === 'marker' ? 'placing markers' : 
                           selectedTool === 'pen' ? 'drawing' :
                           selectedTool === 'brush' ? 'painting' : 'importing image'}
            </Text>
          )}
        </View>
      ) : (
        <Image 
          source={{ uri: imageUrl }}
          style={imageStyle}
          resizeMode="cover"
        />
      )}

      {/* Bottom toolbar */}
      <View style={toolbarStyle}>
        {tools.map((tool) => (
          <IconButton
            key={tool.key}
            icon={tool.icon}
            onPress={() => handleToolSelect(tool.key)}
            style={getToolButtonStyle(tool.key)}
            textStyle={getToolTextStyle(tool.key)}
          />
        ))}
      </View>
    </View>
  );
}