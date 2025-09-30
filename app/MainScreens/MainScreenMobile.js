import { useRef, useState } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import PrimaryButton from '../../components/custom_components/PrimaryButton';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

const panels = [
  { key: 'characters', title: 'Characters & NPCs', items: ['Character Sheets', 'Party Overview', 'NPC Forge', 'Faction Tracker'] },
  { key: 'items', title: 'Items & Treasure', items: ['Inventory', 'Party Loot', 'Treasure Generator', 'Shop Generator'] },
  { key: 'world', title: 'World & Exploration', items: ['Dungeon/Town Creator', 'Battle Map Maker', 'World Map', 'Weather Generator'] },
  { key: 'combat', title: 'Combat & Events', items: ['Encounter Builder', 'Initiative Tracker', 'Event Builder', 'Calendar'] },
  { key: 'story', title: 'Story & Notes', items: ['Quest Log', 'Journal', 'Notes', 'Handouts'] },
];

export default function MainScreenMobile({ navigation }) {
  const [expandedPanel, setExpandedPanel] = useState(null);

  return (
    <ThemedView>
      <View style={{ height: '100%', width: '100%', paddingTop: 42, paddingHorizontal: 0,}}>
       {/* Home Button */}
      <PrimaryButton
        style={{ position: 'absolute', top: 34, left: 16,  zIndex: 1 }}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'WorldList' }] })}
      >
        Go Home
      </PrimaryButton>
      {panels.map((panel) => (
        <ExpandablePanel
          key={panel.key}
          title={panel.title}
          items={panel.items}
          expanded={expandedPanel === panel.key}
          onToggle={() =>
            setExpandedPanel(expandedPanel === panel.key ? null : panel.key)
          }
        />
      ))}

     </View>
    </ThemedView>
  );
}

function ExpandablePanel({ title, items, expanded, onToggle }) {
  const animation = useRef(new Animated.Value(0)).current;

  // Animate expand/collapse
  Animated.timing(animation, {
    toValue: expanded ? 1 : 0,
    duration: 300,
    useNativeDriver: false,
  }).start();

  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [160, 220], // collapsed vs expanded height
  });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.9} style={{ flexGrow: 1 }}>
      <Animated.View
        style={{
          height,
          margin: 0,
          borderRadius: 0,
          backgroundColor: '#e6d3a3',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ThemedText type="title">{title}</ThemedText>
        {expanded && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            {items.map((item, i) => (
              <ThemedText key={i}>{item}</ThemedText>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}
