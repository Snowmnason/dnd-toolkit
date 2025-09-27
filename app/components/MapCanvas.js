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
    <>
      <View style={{ flex: 1, backgroundColor: '#222', borderRadius: 12, margin: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#888' }}>[Map Canvas Area]</Text>
      </View>
      <View style={{ position: 'absolute', bottom: 32, left: 32, right: 32, backgroundColor: '#333', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-around', padding: 16, zIndex: 10 }}>
        {buttons.map(btn => (
          <IconButton
            key={btn.key}
            icon={btn.icon}
            onPress={() => setSelected(btn.key)}
            style={selected === btn.key ? { backgroundColor: '#555', borderRadius: 12 } : {}}
            textStyle={{ color: selected === btn.key ? '#ffd700' : '#fff', fontSize: 24 }}
          />
        ))}
      </View>
    </>
  );
}
