import { logger } from '@/lib/utils'
import type { NavigationContext, RouteConfig } from '../navigationConfig'

// Main app routes (world-dependent)
export const MAIN_ROUTES: RouteConfig[] = [
  // Semantic anchor — no platform constraint; holds the lookup ID and platform branching.
  // navigate.to('home') resolves here, then platformPaths picks the concrete route.
  {
    path: '/main/main-landing',
    semanticId: 'home',
    platformPaths: { mobile: '/main/world', desktop: '/main/main-landing' },
    title: 'D&D Toolkit',
    analyticsName: 'main_home',
  },
  // Concrete platform entries — matched directly when navigating to their exact paths.
  {
    path: '/main/main-landing',
    platform: 'desktop',
    title: 'D&D Toolkit',
    analyticsName: 'main_landing',
    onError: (error: Error, _context: NavigationContext) => {
      logger.category('navigation').error('[Route Error] main-landing:', error.message)
    },
  },

  // Mobile panel entry routes — each is a discrete route on iOS/Android.
  // Desktop uses main-landing instead; these are mobile-only by contract.
  {
    path: '/main/characters',
    title: 'Characters & NPCs',
    platform: 'mobile',
    analyticsName: 'main_characters_panel',
  },
  {
    path: '/main/items',
    title: 'Items & Treasure',
    platform: 'mobile',
    analyticsName: 'main_items_panel',
  },
  {
    path: '/main/world',
    title: 'World & Exploration',
    platform: 'mobile',
    analyticsName: 'main_world_panel',
  },
  {
    path: '/main/combat',
    title: 'Combat & Events',
    platform: 'mobile',
    analyticsName: 'main_combat_panel',
  },
  {
    path: '/main/story',
    title: 'Story & Notes',
    platform: 'mobile',
    analyticsName: 'main_story_panel',
  },

  // Characters & NPCs
  {
    path: '/main/characters-npcs',
    title: 'Characters & NPCs',
    analyticsName: 'main_characters',
  },
  {
    path: '/main/characters-npcs/character-sheets',
    title: 'Character Sheets',
    analyticsName: 'main_character_sheets',
  },
  {
    path: '/main/characters-npcs/faction-tracker',
    title: 'Faction Tracker',
    analyticsName: 'main_faction_tracker',
  },
  {
    path: '/main/characters-npcs/npc-forge',
    title: 'NPC Forge',
    analyticsName: 'main_npc_forge',
  },
  {
    path: '/main/characters-npcs/party-overview',
    title: 'Party Overview',
    analyticsName: 'main_party_overview',
  },

  // Items & Treasure
  {
    path: '/main/items-treasure',
    title: 'Items & Treasure',
    analyticsName: 'main_items',
  },
  {
    path: '/main/items-treasure/inventory',
    title: 'Inventory',
    analyticsName: 'main_items_inventory',
  },
  {
    path: '/main/items-treasure/party-loot',
    title: 'Party Loot',
    analyticsName: 'main_items_party_loot',
  },
  {
    path: '/main/items-treasure/shop-generator',
    title: 'Shop Generator',
    analyticsName: 'main_items_shop_generator',
  },
  {
    path: '/main/items-treasure/treasure-generator',
    title: 'Treasure Generator',
    analyticsName: 'main_items_treasure_generator',
  },

  // World & Exploration
  {
    path: '/main/world-exploration',
    title: 'World & Exploration',
    analyticsName: 'main_world',
  },
  {
    path: '/main/world-exploration/world-map',
    title: 'World Map',
    analyticsName: 'main_world_map',
  },
  {
    path: '/main/world-exploration/weather-generator',
    title: 'Weather Generator',
    analyticsName: 'main_world_weather',
  },
  {
    path: '/main/world-exploration/dungeon-town-creator',
    title: 'Dungeon & Town Creator',
    analyticsName: 'main_world_dungeon_town',
  },
  {
    path: '/main/world-exploration/battle-map-maker',
    title: 'Battle Map Maker',
    analyticsName: 'main_world_battle_map',
  },

  // Combat & Events
  {
    path: '/main/combat-events',
    title: 'Combat & Events',
    analyticsName: 'main_combat',
  },
  {
    path: '/main/combat-events/calendar',
    title: 'Calendar',
    analyticsName: 'main_combat_calendar',
  },
  {
    path: '/main/combat-events/encounter-builder',
    title: 'Encounter Builder',
    analyticsName: 'main_combat_encounter',
  },
  {
    path: '/main/combat-events/event-builder',
    title: 'Event Builder',
    analyticsName: 'main_combat_event',
  },
  {
    path: '/main/combat-events/initiative-tracker',
    title: 'Initiative Tracker',
    analyticsName: 'main_combat_initiative',
  },

  // Story & Notes
  {
    path: '/main/story-notes',
    title: 'Story & Notes',
    analyticsName: 'main_story',
  },
  {
    path: '/main/story-notes/notes',
    title: 'Notes',
    analyticsName: 'main_story_notes',
  },
  {
    path: '/main/story-notes/journal',
    title: 'Journal',
    analyticsName: 'main_story_journal',
  },
  {
    path: '/main/story-notes/handouts',
    title: 'Handouts',
    analyticsName: 'main_story_handouts',
  },
  {
    path: '/main/story-notes/quest-log',
    title: 'Quest Log',
    analyticsName: 'main_story_quest_log',
  },
]
