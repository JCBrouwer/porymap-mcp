// Block represents a single metatile on the map grid
export interface Block {
  metatileId: number;
  collision: number;
  elevation: number;
}

// Block with position for read/write operations
export interface PositionedBlock extends Block {
  x: number;
  y: number;
}

// Layout definition from layouts.json
export interface Layout {
  id: string;
  name: string;
  width: number;
  height: number;
  border_width?: number;
  border_height?: number;
  primary_tileset: string;
  secondary_tileset: string;
  border_filepath: string;
  blockdata_filepath: string;
  [key: string]: unknown; // preserve custom fields
}

// Map header fields from map.json
export interface MapHeader {
  id: string;
  name: string;
  layout: string;
  music: string;
  region_map_section: string;
  requires_flash: boolean;
  weather: string;
  map_type: string;
  show_map_name: boolean;
  battle_scene: string;
  allow_cycling?: boolean;
  allow_escaping?: boolean;
  allow_running?: boolean;
  floor_number?: number;
  [key: string]: unknown;
}

// Full map.json structure
export interface MapJson {
  id: string;
  name: string;
  layout: string;
  music: string;
  region_map_section: string;
  requires_flash: boolean;
  weather: string;
  map_type: string;
  show_map_name: boolean;
  battle_scene: string;
  allow_cycling?: boolean;
  allow_escaping?: boolean;
  allow_running?: boolean;
  floor_number?: number;
  connections?: ConnectionData[];
  shared_events_map?: string;
  shared_scripts_map?: string;
  object_events: ObjectEventData[];
  warp_events: WarpEventData[];
  coord_events: CoordEventData[];
  bg_events: BgEventData[];
  [key: string]: unknown;
}

// Connection data in map.json
export interface ConnectionData {
  map: string;
  direction: string;
  offset: number;
  [key: string]: unknown;
}

// Object event (NPC)
export interface ObjectEventData {
  graphics_id: string;
  x: number;
  y: number;
  elevation: number;
  movement_type: string;
  movement_range_x: number;
  movement_range_y: number;
  trainer_type: string;
  trainer_sight_or_berry_tree_id: string;
  script: string;
  flag: string;
  local_id?: string;
  type?: string; // "object" or "clone_object"
  target_local_id?: string; // clone_object only
  target_map?: string; // clone_object only
  [key: string]: unknown;
}

// Warp event
export interface WarpEventData {
  x: number;
  y: number;
  elevation: number;
  dest_map: string;
  dest_warp_id: string;
  warp_id?: string;
  [key: string]: unknown;
}

// Coord event (trigger or weather_trigger)
export interface CoordEventData {
  type: string; // "trigger" or "weather_trigger"
  x: number;
  y: number;
  elevation: number;
  // trigger fields
  var?: string;
  var_value?: string;
  script?: string;
  // weather_trigger fields
  weather?: string;
  [key: string]: unknown;
}

// BG event (sign, hidden_item, or secret_base)
export interface BgEventData {
  type: string; // "sign", "hidden_item", or "secret_base"
  x: number;
  y: number;
  elevation: number;
  // sign fields
  player_facing_dir?: string;
  script?: string;
  // hidden_item fields
  item?: string;
  flag?: string;
  quantity?: number;
  underfoot?: boolean;
  // secret_base fields
  secret_base_id?: string;
  [key: string]: unknown;
}

// Map groups structure
export interface MapGroups {
  group_order: string[];
  [groupName: string]: string[] | unknown;
}

// Wild encounter entry
export interface WildEncounterMon {
  min_level: number;
  max_level: number;
  species: string;
  [key: string]: unknown;
}

export interface WildEncounterField {
  encounter_rate: number;
  mons: WildEncounterMon[];
  [key: string]: unknown;
}

export interface WildEncounterEntry {
  map: string;
  base_label: string;
  [fieldType: string]: unknown;
}

export interface WildEncounterFieldDef {
  type: string;
  encounter_rates: number[];
  groups?: Record<string, number[]>;
  [key: string]: unknown;
}

export interface WildEncounterGroup {
  label: string;
  for_maps: boolean;
  fields: WildEncounterFieldDef[];
  encounters: WildEncounterEntry[];
  [key: string]: unknown;
}

export interface WildEncountersJson {
  wild_encounter_groups: WildEncounterGroup[];
  [key: string]: unknown;
}

// Heal location entry
export interface HealLocationData {
  id: string;
  map: string;
  x: number;
  y: number;
  respawn_map?: string;
  respawn_npc?: string;
  [key: string]: unknown;
}

export interface HealLocationsJson {
  heal_locations: HealLocationData[];
  [key: string]: unknown;
}

// Layouts.json top-level
export interface LayoutsJson {
  layouts_table_label: string;
  layouts: Layout[];
  [key: string]: unknown;
}

// Constant types the server can provide
export type ConstantType =
  | "species"
  | "items"
  | "flags"
  | "vars"
  | "weather"
  | "songs"
  | "movement_types"
  | "map_types"
  | "battle_scenes"
  | "trainer_types"
  | "obj_event_gfx"
  | "metatile_behaviors"
  | "sign_facing_directions"
  | "secret_bases";

// Project config for file paths
export interface ProjectPaths {
  data_map_folders: string;
  json_map_groups: string;
  json_layouts: string;
  data_layouts_folders: string;
  json_wild_encounters: string;
  json_heal_locations: string;
  tilesets_headers: string;
  tilesets_headers_asm: string;
  constants_items: string;
  constants_flags: string;
  constants_vars: string;
  constants_weather: string;
  constants_songs: string;
  constants_species: string;
  constants_map_types: string;
  constants_trainer_types: string;
  constants_secret_bases: string;
  constants_obj_event_movement: string;
  constants_obj_events: string;
  constants_event_bg: string;
  constants_metatile_behaviors: string;
  constants_metatile_labels: string;
}
