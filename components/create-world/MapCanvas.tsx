import { BorderRadius, Spacing } from '@/constants/theme';
import React, { useState } from 'react';
import { Image, ImageStyle } from 'react-native';
import { Text, View } from 'tamagui';
import IconButton from '../ui/IconButton';

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

  const containerStyle = {
    flex: 1,
    backgroundColor: '#2f353d',//UPDATE TO THEME
    position: 'relative',
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: '#3D444C',//UPDATE TO THEME
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    zIndex: 5,
  };

  const canvasAreaStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const placeholderTextStyle = {
    color: '#C8B9A1',
    fontSize: 16,
  };

  const imageStyle: ImageStyle = {
    flex: 1,
    margin: Spacing.md,
    borderRadius: BorderRadius.sm,
  };

  const toolbarStyle = {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: '#3D444C',
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: Spacing.md,
  };

  const getToolButtonStyle = (toolKey: string) => ({
    backgroundColor: selectedTool === toolKey ? '#8B4513' : 'transparent',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minWidth: 44,
    alignItems: 'center',
  });

  const getToolTextStyle = (toolKey: string) => ({
    color: selectedTool === toolKey ? '#F5E6D3' : '#C8B9A1',
    fontSize: 20,
  });

  return (
    <View style={containerStyle as any}>
      <IconButton 
        icon="❌"
        onPress={onPress}
        style={closeButtonStyle as any}
      />
      
      {/* Canvas area */}
      {!imageImported ? (
        <View style={canvasAreaStyle as any}>
          <Text style={placeholderTextStyle as any}>
            {selectedTool ? `${tools.find(t => t.key === selectedTool)?.label} Tool Selected` : '[Map Canvas Area]'}
          </Text>
          {selectedTool && (
            <Text style={[placeholderTextStyle as any, { marginTop: Spacing.sm, fontSize: 14 }]}> 
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
      <View style={toolbarStyle as any}>
        {tools.map((tool) => (
          <IconButton
            key={tool.key}
            icon={tool.icon}
            onPress={() => handleToolSelect(tool.key)}
            style={getToolButtonStyle(tool.key) as any}
            textStyle={getToolTextStyle(tool.key) as any}
          />
        ))}
      </View>
    </View>
  );
}