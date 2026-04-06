import * as path from "node:path";
import * as fs from "node:fs";
import type {
  ConstantType,
  ProjectPaths,
  MapGroups,
  LayoutsJson,
  MapJson,
  WildEncountersJson,
  HealLocationsJson,
} from "./types.js";
import { parseConstants } from "./data/constants.js";
import { readMapGroups, getMapList, type MapListEntry } from "./data/map-groups.js";
import { readLayouts, getLayoutForMap } from "./data/layouts.js";
import { readMapJson } from "./data/map-json.js";
import { parseTilesetHeaders, parseTilesetHeadersAsm, type TilesetInfo } from "./data/tilesets.js";
import { parseMetatileLabels, type MetatileLabel } from "./data/metatile-labels.js";
import { fileExists, McpError, resolveProjectPath } from "./utils.js";

// Default file paths matching porymap's config.cpp defaults
const DEFAULT_PATHS: ProjectPaths = {
  data_map_folders: "data/maps",
  json_map_groups: "data/maps/map_groups.json",
  json_layouts: "data/layouts/layouts.json",
  data_layouts_folders: "data/layouts",
  json_wild_encounters: "src/data/wild_encounters.json",
  json_heal_locations: "src/data/heal_locations.json",
  tilesets_headers: "src/data/tilesets/headers.h",
  tilesets_headers_asm: "data/tilesets/headers.inc",
  constants_items: "include/constants/items.h",
  constants_flags: "include/constants/flags.h",
  constants_vars: "include/constants/vars.h",
  constants_weather: "include/constants/weather.h",
  constants_songs: "include/constants/songs.h",
  constants_species: "include/constants/species.h",
  constants_map_types: "include/constants/map_types.h",
  constants_trainer_types: "include/constants/trainer_types.h",
  constants_secret_bases: "include/constants/secret_bases.h",
  constants_obj_event_movement: "include/constants/event_object_movement.h",
  constants_obj_events: "include/constants/event_objects.h",
  constants_event_bg: "include/constants/event_bg.h",
  constants_metatile_behaviors: "include/constants/metatile_behaviors.h",
  constants_metatile_labels: "include/constants/metatile_labels.h",
};

// Map constant types to their header file path keys
const CONSTANT_FILE_MAP: Record<ConstantType, keyof ProjectPaths> = {
  species: "constants_species",
  items: "constants_items",
  flags: "constants_flags",
  vars: "constants_vars",
  weather: "constants_weather",
  songs: "constants_songs",
  movement_types: "constants_obj_event_movement",
  map_types: "constants_map_types",
  battle_scenes: "constants_map_types", // same file as map_types
  trainer_types: "constants_trainer_types",
  obj_event_gfx: "constants_obj_events",
  metatile_behaviors: "constants_metatile_behaviors",
  sign_facing_directions: "constants_event_bg",
  secret_bases: "constants_secret_bases",
};

export class ProjectContext {
  readonly root: string;
  readonly paths: ProjectPaths;
  private constantsCache: Map<ConstantType, string[]> = new Map();
  private tilesetCache: TilesetInfo[] | null = null;
  private metatileLabelCache: MetatileLabel[] | null = null;
  private mapConstantCache: Map<string, string> | null = null;

  constructor(projectRoot: string) {
    this.root = path.resolve(projectRoot);
    this.paths = { ...DEFAULT_PATHS };
    this.validate();
  }

  private validate(): void {
    if (!fs.existsSync(this.root)) {
      throw new McpError("PROJECT_NOT_FOUND", `Project directory not found: ${this.root}`);
    }
    // Check for key indicator files
    const mapGroupsPath = this.resolve(this.paths.json_map_groups);
    if (!fileExists(mapGroupsPath)) {
      throw new McpError(
        "PROJECT_NOT_FOUND",
        `Not a valid porymap project: ${this.root} (missing ${this.paths.json_map_groups})`,
      );
    }
  }

  resolve(relativePath: string): string {
    return resolveProjectPath(this.root, relativePath);
  }

  // --- Map groups ---
  readMapGroups(): MapGroups {
    return readMapGroups(this.resolve(this.paths.json_map_groups));
  }

  getMapList(): MapListEntry[] {
    return getMapList(this.readMapGroups());
  }

  // --- Layouts ---
  readLayouts(): LayoutsJson {
    return readLayouts(this.resolve(this.paths.json_layouts));
  }

  // --- Map JSON ---
  getMapJsonPath(mapName: string): string {
    return this.resolve(path.join(this.paths.data_map_folders, mapName, "map.json"));
  }

  readMapJson(mapName: string): MapJson {
    const filepath = this.getMapJsonPath(mapName);
    if (!fileExists(filepath)) {
      throw new McpError("MAP_NOT_FOUND", `Map '${mapName}' not found at ${filepath}`);
    }
    return readMapJson(filepath);
  }

  // Resolve a map name from either the name or constant
  resolveMapName(mapNameOrConstant: string): string {
    // If it doesn't look like a constant, use it directly as a map name
    if (!mapNameOrConstant.startsWith("MAP_")) {
      return mapNameOrConstant;
    }
    // Build and cache the constant→name lookup on first use
    if (!this.mapConstantCache) {
      const cache = new Map<string, string>();
      for (const map of this.getMapList()) {
        try {
          const mapJson = this.readMapJson(map.name);
          if (mapJson.id) cache.set(mapJson.id, map.name);
        } catch {
          // Skip unreadable maps
        }
      }
      this.mapConstantCache = cache;
    }
    const name = this.mapConstantCache.get(mapNameOrConstant);
    if (!name) {
      throw new McpError("MAP_NOT_FOUND", `No map found with constant '${mapNameOrConstant}'`);
    }
    return name;
  }

  // Get layout for a map
  getLayoutForMap(mapName: string): { layout: import("./types.js").Layout; layoutsData: LayoutsJson } {
    const mapData = this.readMapJson(mapName);
    const layoutsData = this.readLayouts();
    const layout = getLayoutForMap(layoutsData, mapData.layout);
    return { layout, layoutsData };
  }

  // --- Constants ---
  getConstants(type: ConstantType): string[] {
    const cached = this.constantsCache.get(type);
    if (cached) return cached;

    const fileKey = CONSTANT_FILE_MAP[type];
    const filepath = this.resolve(this.paths[fileKey]);
    const constants = parseConstants(filepath, type);
    this.constantsCache.set(type, constants);
    return constants;
  }

  clearConstantsCache(): void {
    this.constantsCache.clear();
    this.tilesetCache = null;
    this.metatileLabelCache = null;
    this.mapConstantCache = null;
  }

  // --- Tilesets ---
  getTilesets(): TilesetInfo[] {
    if (this.tilesetCache) return this.tilesetCache;

    const cPath = this.resolve(this.paths.tilesets_headers);
    let tilesets = parseTilesetHeaders(cPath);
    if (tilesets.length === 0) {
      const asmPath = this.resolve(this.paths.tilesets_headers_asm);
      tilesets = parseTilesetHeadersAsm(asmPath);
    }
    this.tilesetCache = tilesets;
    return tilesets;
  }

  getPrimaryTilesets(): string[] {
    return this.getTilesets().filter((t) => !t.isSecondary).map((t) => t.name);
  }

  getSecondaryTilesets(): string[] {
    return this.getTilesets().filter((t) => t.isSecondary).map((t) => t.name);
  }

  // --- Metatile labels ---
  getMetatileLabels(): MetatileLabel[] {
    if (this.metatileLabelCache) return this.metatileLabelCache;

    const filepath = this.resolve(this.paths.constants_metatile_labels);
    this.metatileLabelCache = parseMetatileLabels(filepath);
    return this.metatileLabelCache;
  }

  // --- Wild encounters ---
  readWildEncounters(): WildEncountersJson | null {
    const filepath = this.resolve(this.paths.json_wild_encounters);
    if (!fileExists(filepath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filepath, "utf-8"));
    } catch {
      return null;
    }
  }

  // --- Heal locations ---
  readHealLocations(): HealLocationsJson | null {
    const filepath = this.resolve(this.paths.json_heal_locations);
    if (!fileExists(filepath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filepath, "utf-8"));
    } catch {
      return null;
    }
  }

  // --- Project info ---
  getProjectInfo() {
    const maps = this.getMapList();
    const groups = this.readMapGroups();
    const tilesets = this.getTilesets();
    const hasWildEncounters = fileExists(
      this.resolve(this.paths.json_wild_encounters),
    );
    const hasHealLocations = fileExists(
      this.resolve(this.paths.json_heal_locations),
    );

    return {
      root: this.root,
      mapCount: maps.length,
      groupNames: groups.group_order,
      tilesetCount: tilesets.length,
      primaryTilesetCount: tilesets.filter((t) => !t.isSecondary).length,
      secondaryTilesetCount: tilesets.filter((t) => t.isSecondary).length,
      hasWildEncounters,
      hasHealLocations,
    };
  }
}
