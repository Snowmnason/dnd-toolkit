import { useState } from 'react';
import { Text, View } from 'react-native';
import IconButton from './IconButton';

export default function MapCanvas() {
  const [selected, setSelected] = useState(null);

  const buttons = [
    { icon: '🖊️', key: 'pen' },
    { icon: '🖌️', key: 'brush' },
    { icon: '🗺️', key: 'map' },
    { icon: '🖼️', key: 'image' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#222', position: 'relative' }}>
      {/* Canvas area */}
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#888' }}>[Map Canvas Area]</Text>
      </View>

      {/* Bottom toolbar */}
      <View
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          backgroundColor: '#333',
          borderRadius: 24,
          flexDirection: 'row',
          justifyContent: 'space-around',
          padding: 12,
        }}
      >
        {buttons.map((btn) => (
          <IconButton
            key={btn.key}
            icon={btn.icon}
            onPress={() => setSelected(btn.key)}
            style={{
              backgroundColor: selected === btn.key ? '#555' : 'transparent',
              borderRadius: 12,
              padding: 8,
            }}
            textStyle={{
              color: selected === btn.key ? '#ffd700' : '#fff',
              fontSize: 22,
            }}
          />
        ))}
      </View>
    </View>
  );
}
