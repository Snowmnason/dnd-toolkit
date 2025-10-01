import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

const panels = [
  { 
    key: 'characters', 
    title: 'Characters & NPCs', 
    items: [
      { name: 'Character Sheets', route: 'characters-npcs/character-sheets' },
      { name: 'Party Overview', route: 'characters-npcs/party-overview' },
      { name: 'NPC Forge', route: 'characters-npcs/npc-forge' },
      { name: 'Faction Tracker', route: 'characters-npcs/faction-tracker' }
    ] 
  },
  { 
    key: 'items', 
    title: 'Items & Treasure', 
    items: [
      { name: 'Inventory', route: 'items-treasure/inventory' },
      { name: 'Party Loot', route: 'items-treasure/party-loot' },
      { name: 'Treasure Generator', route: 'items-treasure/treasure-generator' },
      { name: 'Shop Generator', route: 'items-treasure/shop-generator' }
    ] 
  },
  { 
    key: 'world', 
    title: 'World & Exploration', 
    items: [
      { name: 'Dungeon/Town Creator', route: 'world-exploration/dungeon-town-creator' },
      { name: 'Battle Map Maker', route: 'world-exploration/battle-map-maker' },
      { name: 'World Map', route: 'world-exploration/world-map' },
      { name: 'Weather Generator', route: 'world-exploration/weather-generator' }
    ] 
  },
  { 
    key: 'combat', 
    title: 'Combat & Events', 
    items: [
      { name: 'Encounter Builder', route: 'combat-events/encounter-builder' },
      { name: 'Initiative Tracker', route: 'combat-events/initiative-tracker' },
      { name: 'Event Builder', route: 'combat-events/event-builder' },
      { name: 'Calendar', route: 'combat-events/calendar' }
    ] 
  },
  { 
    key: 'story', 
    title: 'Story & Notes', 
    items: [
      { name: 'Quest Log', route: 'story-notes/quest-log' },
      { name: 'Journal', route: 'story-notes/journal' },
      { name: 'Notes', route: 'story-notes/notes' },
      { name: 'Handouts', route: 'story-notes/handouts' }
    ] 
  },
];

export default function MainScreenMobile() {
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const router = useRouter();

  return (
    <ThemedView>
      <View style={{ height: '100%', width: '100%', paddingTop: 0, paddingHorizontal: 0,}}>
      {panels.map((panel) => (
        <ExpandablePanel
          key={panel.key}
          title={panel.title}
          items={panel.items}
          expanded={expandedPanel === panel.key}
          onToggle={() =>
            setExpandedPanel(expandedPanel === panel.key ? null : panel.key)
          }
          router={router}
        />
      ))}

     </View>
    </ThemedView>
  );
}

interface PanelItem {
  name: string;
  route: string;
}

interface ExpandablePanelProps {
  title: string;
  items: PanelItem[];
  expanded: boolean;
  onToggle: () => void;
  router: any;
}

function ExpandablePanel({ title, items, expanded, onToggle, router }: ExpandablePanelProps) {
  const animation = useRef(new Animated.Value(0)).current;

  // Animate expand/collapse
  Animated.timing(animation, {
    toValue: expanded ? 1 : 0,
    duration: 300,
    useNativeDriver: false,
  }).start();

  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [160, 280], // collapsed vs expanded height
  });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.9} style={{ flexGrow: 1 }}>
      <Animated.View
        style={{
          height,
          margin: 0,
          borderRadius: 2,
          backgroundColor: '#292928ff',
          borderColor: '#6e6d6dff',
          borderWidth: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ThemedText type="title">{title}</ThemedText>
        {expanded && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            {items.map((item, i) => (
              <TouchableOpacity 
                key={i}
                onPress={() => router.push(`/main/${item.route}` as any)}
                style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  padding: 8,
                  marginBottom: 4,
                  borderRadius: 6,
                  minWidth: 300,
                  alignItems: 'center'
                }}
              >
                <ThemedText 
                  numberOfLines={1}
                  style={{ 
                    textAlign: 'center',
                  }}
                >
                  {item.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}
