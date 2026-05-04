import { logger } from '@/lib/utils'
import type { NavigationContext, RouteConfig } from '../navigationConfig'

// Main app routes (world-dependent)
export const MAIN_ROUTES: RouteConfig[] = [
  // Semantic anchor — dispatch only; navigate.to('home') resolves here.
  // getRouteConfig() skips this entry (semanticAnchor: true).
  // The concrete desktop and mobile entries below are the real route configs.
  {
    path: '/main/main-landing',
    semanticAnchor: true,
    semanticId: 'home',
    platformPaths: { mobile: '/main/world', desktop: '/main/main-landing' },
    title: 'D&D Toolkit',
    analyticsName: 'main_home',
    backDestination: '/select/world-selection',
  },
  // Concrete platform entries — matched directly when navigating to their exact paths.
  {
    path: '/main/main-landing',
    platform: 'desktop',
    title: 'D&D Toolkit',
    analyticsName: 'main_landing',
    backDestination: '/select/world-selection',
    onError: (error: Error, _context: NavigationContext) => {
      logger.category('navigation').error('[Route Error] main-landing:', error.message)
    },
  },
  {
    path: '/main/world',
    platform: 'mobile',
    title: 'World & Exploration',
    analyticsName: 'main_world_landing',
    backDestination: '/select/world-selection',
    onError: (error: Error, _context: NavigationContext) => {
      logger.category('navigation').error('[Route Error] world-landing:', error.message)
    },
  },

  // Mobile panel entry routes — each is a discrete route on iOS/Android.
  // Desktop uses main-landing instead; these are mobile-only by contract.
  // Note: /main/world is intentionally absent here — it is already covered by
  // the concrete mobile landing entry above (main_world_landing).
  {
    path: '/main/characters',
    title: 'Characters & NPCs',
    platform: 'mobile',
    analyticsName: 'main_characters_panel',
    backDestination: '/select/world-selection',
  },
  {
    path: '/main/items',
    title: 'Items & Treasure',
    platform: 'mobile',
    analyticsName: 'main_items_panel',
    backDestination: '/select/world-selection',
  },
  {
    path: '/main/combat',
    title: 'Combat & Events',
    platform: 'mobile',
    analyticsName: 'main_combat_panel',
    backDestination: '/select/world-selection',
  },
  {
    path: '/main/story',
    title: 'Story & Notes',
    platform: 'mobile',
    analyticsName: 'main_story_panel',
    backDestination: '/select/world-selection',
  },

  // Characters & NPCs
  {
    path: '/main/characters-npcs',
    title: 'Characters & NPCs',
    analyticsName: 'main_characters',
    backDestination: (context) => context.isMobile ? '/main/characters' : '/main/main-landing',
  },
  {
    path: '/main/characters-npcs/character-sheets',
    title: 'Character Sheets',
    analyticsName: 'main_character_sheets',
    backDestination: (context) => context.isMobile ? '/main/characters' : '/main/main-landing',
  },
  {
    path: '/main/characters-npcs/faction-tracker',
    title: 'Faction Tracker',
    analyticsName: 'main_faction_tracker',
    backDestination: (context) => context.isMobile ? '/main/characters' : '/main/main-landing',
  },
  {
    path: '/main/characters-npcs/npc-forge',
    title: 'NPC Forge',
    analyticsName: 'main_npc_forge',
    backDestination: (context) => context.isMobile ? '/main/characters' : '/main/main-landing',
  },
  {
    path: '/main/characters-npcs/party-overview',
    title: 'Party Overview',
    analyticsName: 'main_party_overview',
    backDestination: (context) => context.isMobile ? '/main/characters' : '/main/main-landing',
  },

  // Items & Treasure
  {
    path: '/main/items-treasure',
    title: 'Items & Treasure',
    analyticsName: 'main_items',
    backDestination: (context) => context.isMobile ? '/main/items' : '/main/main-landing',
  },
  {
    path: '/main/items-treasure/inventory',
    title: 'Inventory',
    analyticsName: 'main_items_inventory',
    backDestination: (context) => context.isMobile ? '/main/items' : '/main/main-landing',
  },
  {
    path: '/main/items-treasure/party-loot',
    title: 'Party Loot',
    analyticsName: 'main_items_party_loot',
    backDestination: (context) => context.isMobile ? '/main/items' : '/main/main-landing',
  },
  {
    path: '/main/items-treasure/shop-generator',
    title: 'Shop Generator',
    analyticsName: 'main_items_shop_generator',
    backDestination: (context) => context.isMobile ? '/main/items' : '/main/main-landing',
  },
  {
    path: '/main/items-treasure/treasure-generator',
    title: 'Treasure Generator',
    analyticsName: 'main_items_treasure_generator',
    backDestination: (context) => context.isMobile ? '/main/items' : '/main/main-landing',
  },

  // World & Exploration
  {
    path: '/main/world-exploration',
    title: 'World & Exploration',
    analyticsName: 'main_world',
    backDestination: (context) => context.isMobile ? '/main/world' : '/main/main-landing',
  },
  {
    path: '/main/world-exploration/world-map',
    title: 'World Map',
    analyticsName: 'main_world_map',
    backDestination: (context) => context.isMobile ? '/main/world' : '/main/main-landing',
  },
  {
    path: '/main/world-exploration/weather-generator',
    title: 'Weather Generator',
    analyticsName: 'main_world_weather',
    backDestination: (context) => context.isMobile ? '/main/world' : '/main/main-landing',
  },
  {
    path: '/main/world-exploration/dungeon-town-creator',
    title: 'Dungeon & Town Creator',
    analyticsName: 'main_world_dungeon_town',
    backDestination: (context) => context.isMobile ? '/main/world' : '/main/main-landing',
  },
  {
    path: '/main/world-exploration/battle-map-maker',
    title: 'Battle Map Maker',
    analyticsName: 'main_world_battle_map',
    backDestination: (context) => context.isMobile ? '/main/world' : '/main/main-landing',
  },

  // Combat & Events
  {
    path: '/main/combat-events',
    title: 'Combat & Events',
    analyticsName: 'main_combat',
    backDestination: (context) => context.isMobile ? '/main/combat' : '/main/main-landing',
  },
  {
    path: '/main/combat-events/calendar',
    title: 'Calendar',
    analyticsName: 'main_combat_calendar',
    backDestination: (context) => context.isMobile ? '/main/combat' : '/main/main-landing',
  },
  {
    path: '/main/combat-events/encounter-builder',
    title: 'Encounter Builder',
    analyticsName: 'main_combat_encounter',
    backDestination: (context) => context.isMobile ? '/main/combat' : '/main/main-landing',
  },
  {
    path: '/main/combat-events/event-builder',
    title: 'Event Builder',
    analyticsName: 'main_combat_event',
    backDestination: (context) => context.isMobile ? '/main/combat' : '/main/main-landing',
  },
  {
    path: '/main/combat-events/initiative-tracker',
    title: 'Initiative Tracker',
    analyticsName: 'main_combat_initiative',
    backDestination: (context) => context.isMobile ? '/main/combat' : '/main/main-landing',
  },

  // Story & Notes
  {
    path: '/main/story-notes',
    title: 'Story & Notes',
    analyticsName: 'main_story',
    backDestination: (context) => context.isMobile ? '/main/story' : '/main/main-landing',
  },
  {
    path: '/main/story-notes/notes',
    title: 'Notes',
    analyticsName: 'main_story_notes',
    backDestination: (context) => context.isMobile ? '/main/story' : '/main/main-landing',
  },
  {
    path: '/main/story-notes/journal',
    title: 'Journal',
    analyticsName: 'main_story_journal',
    backDestination: (context) => context.isMobile ? '/main/story' : '/main/main-landing',
  },
  {
    path: '/main/story-notes/handouts',
    title: 'Handouts',
    analyticsName: 'main_story_handouts',
    backDestination: (context) => context.isMobile ? '/main/story' : '/main/main-landing',
  },
  {
    path: '/main/story-notes/quest-log',
    title: 'Quest Log',
    analyticsName: 'main_story_quest_log',
    backDestination: (context) => context.isMobile ? '/main/story' : '/main/main-landing',
  },
]
