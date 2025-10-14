// Shared panel configuration for both desktop and mobile
export interface PanelItem {
  name: string;
  route: string;
}

export interface PanelConfig {
  key: string;
  title: string;
  icon: string; // Will be replaced with proper icons later
  items: PanelItem[];
}

export const panelConfigs: PanelConfig[] = [
  {
    key: 'characters',
    title: 'Characters & NPCs',
    icon: '👥', // Placeholder - replace with actual icon component
    items: [
      { name: 'Character Sheets', route: 'characters-npcs/character-sheets' },
      { name: 'Party Overview', route: 'characters-npcs/party-overview' },
      { name: 'NPC Forge', route: 'characters-npcs/npc-forge' },
      { name: 'Faction Tracker', route: 'characters-npcs/faction-tracker' },
    ],
  },
  {
    key: 'items',
    title: 'Items & Treasure',
    icon: '💎', // Placeholder
    items: [
      { name: 'Inventory', route: 'items-treasure/inventory' },
      { name: 'Party Loot', route: 'items-treasure/party-loot' },
      { name: 'Treasure Generator', route: 'items-treasure/treasure-generator' },
      { name: 'Shop Generator', route: 'items-treasure/shop-generator' },
    ],
  },
  {
    key: 'world',
    title: 'World & Exploration',
    icon: '🗺️', // Placeholder
    items: [
      { name: 'Dungeon/Town Creator', route: 'world-exploration/dungeon-town-creator' },
      { name: 'Battle Map Maker', route: 'world-exploration/battle-map-maker' },
      { name: 'World Map', route: 'world-exploration/world-map' },
      { name: 'Weather Generator', route: 'world-exploration/weather-generator' },
    ],
  },
  {
    key: 'combat',
    title: 'Combat & Events',
    icon: '⚔️', // Placeholder
    items: [
      { name: 'Encounter Builder', route: 'combat-events/encounter-builder' },
      { name: 'Initiative Tracker', route: 'combat-events/initiative-tracker' },
      { name: 'Event Builder', route: 'combat-events/event-builder' },
      { name: 'Calendar', route: 'combat-events/calendar' },
    ],
  },
  {
    key: 'story',
    title: 'Story & Notes',
    icon: '📖', // Placeholder
    items: [
      { name: 'Quest Log', route: 'story-notes/quest-log' },
      { name: 'Journal', route: 'story-notes/journal' },
      { name: 'Notes', route: 'story-notes/notes' },
      { name: 'Handouts', route: 'story-notes/handouts' },
    ],
  },
];
