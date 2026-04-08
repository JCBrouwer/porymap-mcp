/**
 * Test helpers: create a minimal in-memory Pokemon project in a temp directory.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { writeBlockdata } from "../src/utils.js";
import type { Block } from "../src/types.js";

export interface TestProject {
  root: string;
  cleanup: () => void;
}

// Minimal map data for "PetalburgCity"
export const MAP_PETALBURG = "PetalburgCity";
export const MAP_PETALBURG_CONST = "MAP_PETALBURG_CITY";
export const MAP_ROUTE101 = "Route101";
export const MAP_ROUTE101_CONST = "MAP_ROUTE101";

/** Write a minimal binary blockdata (4x4 = 16 blocks) */
function makeBlockdata(metatileId = 1): Buffer {
  const blocks: Block[] = [];
  for (let i = 0; i < 16; i++) {
    blocks.push({ metatileId, collision: 0, elevation: 3 });
  }
  const buf = Buffer.alloc(blocks.length * 2);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const raw =
      (b.metatileId & 0x3ff) |
      ((b.collision & 0x3) << 10) |
      ((b.elevation & 0xf) << 12);
    buf.writeUInt16LE(raw, i * 2);
  }
  return buf;
}

/** Write a 2x2 border blockdata */
function makeBorderdata(metatileId = 2): Buffer {
  const blocks: Block[] = [];
  for (let i = 0; i < 4; i++) {
    blocks.push({ metatileId, collision: 0, elevation: 0 });
  }
  const buf = Buffer.alloc(blocks.length * 2);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const raw =
      (b.metatileId & 0x3ff) |
      ((b.collision & 0x3) << 10) |
      ((b.elevation & 0xf) << 12);
    buf.writeUInt16LE(raw, i * 2);
  }
  return buf;
}

function mapJson(name: string, constant: string, layoutId: string) {
  return {
    id: constant,
    name,
    layout: layoutId,
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_NONE",
    requires_flash: false,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_TOWN",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [],
    object_events: [
      {
        graphics_id: "OBJ_EVENT_GFX_YOUNGSTER",
        x: 3,
        y: 5,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: `${name}_EventScript_NPC`,
        flag: "0",
      },
    ],
    warp_events: [
      {
        x: 1,
        y: 2,
        elevation: 0,
        dest_map: "MAP_LITTLEROOT_TOWN",
        dest_warp_id: "0",
        warp_id: "0",
      },
    ],
    coord_events: [
      {
        type: "trigger",
        x: 5,
        y: 5,
        elevation: 0,
        var: "VAR_TEMP_0",
        var_value: "0",
        script: `${name}_EventScript_Trigger`,
      },
    ],
    bg_events: [
      {
        type: "sign",
        x: 7,
        y: 3,
        elevation: 0,
        player_facing_dir: "BG_EVENT_PLAYER_FACING_ANY",
        script: `${name}_EventScript_Sign`,
      },
    ],
  };
}

// Constants for the realistic test project
export const MAP_TOWN_A = "TownA";
export const MAP_TOWN_A_CONST = "MAP_TOWN_A";
export const MAP_ROUTE_NORTH = "RouteNorth";
export const MAP_ROUTE_NORTH_CONST = "MAP_ROUTE_NORTH";
export const MAP_ROUTE_SOUTH = "RouteSouth";
export const MAP_ROUTE_SOUTH_CONST = "MAP_ROUTE_SOUTH";
export const MAP_CAVE = "DeepCave";
export const MAP_CAVE_CONST = "MAP_DEEP_CAVE";

/**
 * Create a realistic test project with 4 maps and connections between them.
 * 
 * Structure:
 * - TownA (4x4) <--> RouteNorth (4x4) [east/west connection]
 * - RouteSouth (4x4) <--> DeepCave (4x4) [down/up connection]
 * 
 * TownA has a connection to RouteNorth (east), and RouteNorth has a mirror back (west).
 * RouteSouth has a connection to DeepCave (down), and DeepCave has a mirror back (up).
 */
export function createRealisticTestProject(): TestProject {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "porymap-realistic-test-"));

  // --- Directory structure ---
  const dirs = [
    "data/maps/TownA",
    "data/maps/RouteNorth",
    "data/maps/RouteSouth",
    "data/maps/DeepCave",
    "data/layouts/TownA",
    "data/layouts/RouteNorth",
    "data/layouts/RouteSouth",
    "data/layouts/DeepCave",
    "src/data",
    "include/constants",
    "src/data/tilesets",
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }

  // --- map_groups.json ---
  const mapGroups = {
    group_order: ["gMapGroup_Towns", "gMapGroup_Routes", "gMapGroup_Caves"],
    gMapGroup_Towns: ["TownA"],
    gMapGroup_Routes: ["RouteNorth", "RouteSouth"],
    gMapGroup_Caves: ["DeepCave"],
  };
  fs.writeFileSync(
    path.join(root, "data/maps/map_groups.json"),
    JSON.stringify(mapGroups, null, 4),
  );

  // --- layouts.json ---
  const layouts = {
    layouts_table_label: "gMapLayouts",
    layouts: [
      {
        id: "LAYOUT_TOWN_A",
        name: "TownA",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Petalburg",
        border_filepath: "data/layouts/TownA/border.bin",
        blockdata_filepath: "data/layouts/TownA/map.bin",
      },
      {
        id: "LAYOUT_ROUTE_NORTH",
        name: "RouteNorth",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Route101",
        border_filepath: "data/layouts/RouteNorth/border.bin",
        blockdata_filepath: "data/layouts/RouteNorth/map.bin",
      },
      {
        id: "LAYOUT_ROUTE_SOUTH",
        name: "RouteSouth",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Route101",
        border_filepath: "data/layouts/RouteSouth/border.bin",
        blockdata_filepath: "data/layouts/RouteSouth/map.bin",
      },
      {
        id: "LAYOUT_DEEP_CAVE",
        name: "DeepCave",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Cave",
        border_filepath: "data/layouts/DeepCave/border.bin",
        blockdata_filepath: "data/layouts/DeepCave/map.bin",
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, "data/layouts/layouts.json"),
    JSON.stringify(layouts, null, 4),
  );

  // --- blockdata files ---
  const mapBin = makeBlockdata(1);
  const borderBin = makeBorderdata(2);
  
  for (const mapName of ["TownA", "RouteNorth", "RouteSouth", "DeepCave"]) {
    fs.writeFileSync(path.join(root, `data/layouts/${mapName}/map.bin`), mapBin);
    fs.writeFileSync(path.join(root, `data/layouts/${mapName}/border.bin`), borderBin);
  }

  // --- map.json files with connections ---
  
  // TownA has a connection east to RouteNorth
  const townAMapJson = {
    id: MAP_TOWN_A_CONST,
    name: MAP_TOWN_A,
    layout: "LAYOUT_TOWN_A",
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_TOWN_A",
    requires_flash: false,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_TOWN",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [
      { map: MAP_ROUTE_NORTH_CONST, direction: "right", offset: 0 },
    ],
    object_events: [
      {
        graphics_id: "OBJ_EVENT_GFX_YOUNGSTER",
        x: 2, y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: `${MAP_TOWN_A}_EventScript_NPC`,
        flag: "0",
      },
    ],
    warp_events: [],
    coord_events: [],
    bg_events: [
      {
        type: "sign",
        x: 1, y: 1,
        elevation: 0,
        player_facing_dir: "BG_EVENT_PLAYER_FACING_ANY",
        script: `${MAP_TOWN_A}_EventScript_Sign`,
      },
    ],
  };

  // RouteNorth has a connection west to TownA (mirror) and connection east (which leads nowhere in our test)
  const routeNorthMapJson = {
    id: MAP_ROUTE_NORTH_CONST,
    name: MAP_ROUTE_NORTH,
    layout: "LAYOUT_ROUTE_NORTH",
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_ROUTE_NORTH",
    requires_flash: false,
    weather: "WEATHER_SUNNY",
    map_type: "MAP_TYPE_ROUTE",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [
      { map: MAP_TOWN_A_CONST, direction: "left", offset: 0 }, // mirror of TownA's right connection
    ],
    object_events: [
      {
        graphics_id: "OBJ_EVENT_GFX_YOUNGSTER",
        x: 3, y: 3,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: `${MAP_ROUTE_NORTH}_EventScript_NPC`,
        flag: "0",
      },
    ],
    warp_events: [],
    coord_events: [
      {
        type: "trigger",
        x: 2, y: 2,
        elevation: 0,
        var: "VAR_TEMP_0",
        var_value: "0",
        script: `${MAP_ROUTE_NORTH}_EventScript_Trigger`,
      },
    ],
    bg_events: [],
  };

  // RouteSouth has a connection down to DeepCave
  const routeSouthMapJson = {
    id: MAP_ROUTE_SOUTH_CONST,
    name: MAP_ROUTE_SOUTH,
    layout: "LAYOUT_ROUTE_SOUTH",
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_ROUTE_SOUTH",
    requires_flash: false,
    weather: "WEATHER_RAIN",
    map_type: "MAP_TYPE_ROUTE",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [
      { map: MAP_CAVE_CONST, direction: "down", offset: 0 },
    ],
    object_events: [
      {
        graphics_id: "OBJ_EVENT_GFX_LASS",
        x: 1, y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NORMAL",
        trainer_sight_or_berry_tree_id: "5",
        script: `${MAP_ROUTE_SOUTH}_EventScript_Trainer`,
        flag: "FLAG_TEMP_1",
      },
    ],
    warp_events: [],
    coord_events: [],
    bg_events: [
      {
        type: "hidden_item",
        x: 3, y: 3,
        elevation: 0,
        item: "ITEM_POTION",
        flag: "FLAG_ITEM_POTION_1",
        quantity: 1,
        underfoot: false,
      },
    ],
  };

  // DeepCave has a connection up to RouteSouth (mirror)
  const caveMapJson = {
    id: MAP_CAVE_CONST,
    name: MAP_CAVE,
    layout: "LAYOUT_DEEP_CAVE",
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_DEEP_CAVE",
    requires_flash: true,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_UNDERGROUND",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [
      { map: MAP_ROUTE_SOUTH_CONST, direction: "up", offset: 0 }, // mirror of RouteSouth's down connection
    ],
    object_events: [
      {
        graphics_id: "OBJ_EVENT_GFX_YOUNGSTER",
        x: 2, y: 2,
        elevation: 3,
        movement_type: "MOVEMENT_TYPE_FACE_DOWN",
        movement_range_x: 0,
        movement_range_y: 0,
        trainer_type: "TRAINER_TYPE_NONE",
        trainer_sight_or_berry_tree_id: "0",
        script: `${MAP_CAVE}_EventScript_NPC`,
        flag: "0",
      },
    ],
    warp_events: [
      {
        x: 1, y: 1,
        elevation: 0,
        dest_map: MAP_ROUTE_SOUTH_CONST,
        dest_warp_id: "0",
        warp_id: "0",
      },
    ],
    coord_events: [],
    bg_events: [],
  };

  fs.writeFileSync(
    path.join(root, "data/maps/TownA/map.json"),
    JSON.stringify(townAMapJson, null, 4),
  );
  fs.writeFileSync(
    path.join(root, "data/maps/RouteNorth/map.json"),
    JSON.stringify(routeNorthMapJson, null, 4),
  );
  fs.writeFileSync(
    path.join(root, "data/maps/RouteSouth/map.json"),
    JSON.stringify(routeSouthMapJson, null, 4),
  );
  fs.writeFileSync(
    path.join(root, "data/maps/DeepCave/map.json"),
    JSON.stringify(caveMapJson, null, 4),
  );

  // --- wild_encounters.json ---
  const wildEncounters = {
    wild_encounter_groups: [
      {
        label: "gWildMonHeaders",
        for_maps: true,
        fields: [
          { type: "land", encounter_rates: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1], groups: {} },
          { type: "water", encounter_rates: [60, 30, 5, 4, 1], groups: {} },
        ],
        encounters: [
          {
            map: MAP_ROUTE_NORTH_CONST,
            base_label: "gRouteNorthWildMons",
            land: {
              encounter_rate: 20,
              mons: [
                { min_level: 2, max_level: 3, species: "SPECIES_ZIGZAGOON" },
                { min_level: 2, max_level: 3, species: "SPECIES_WURMPLE" },
                { min_level: 3, max_level: 4, species: "SPECIES_ZIGZAGOON" },
                { min_level: 3, max_level: 4, species: "SPECIES_WURMPLE" },
                { min_level: 5, max_level: 5, species: "SPECIES_POOCHYENA" },
                { min_level: 4, max_level: 5, species: "SPECIES_POOCHYENA" },
                { min_level: 3, max_level: 3, species: "SPECIES_POOCHYENA" },
                { min_level: 3, max_level: 5, species: "SPECIES_POOCHYENA" },
              ],
            },
          },
        ],
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, "src/data/wild_encounters.json"),
    JSON.stringify(wildEncounters, null, 4),
  );

  // --- heal_locations.json ---
  const healLocations = {
    heal_locations: [
      { id: "HEAL_LOCATION_TOWN_A", map: MAP_TOWN_A_CONST, x: 2, y: 2 },
      { id: "HEAL_LOCATION_DEEP_CAVE", map: MAP_CAVE_CONST, x: 2, y: 3 },
    ],
  };
  fs.writeFileSync(
    path.join(root, "src/data/heal_locations.json"),
    JSON.stringify(healLocations, null, 4),
  );

  // --- constants headers (reuse from createTestProject) ---
  fs.writeFileSync(path.join(root, "include/constants/species.h"), `
#define SPECIES_NONE            0
#define SPECIES_ZIGZAGOON     263
#define SPECIES_WURMPLE       265
#define SPECIES_POOCHYENA     261
`);

  fs.writeFileSync(path.join(root, "include/constants/items.h"), `
#define ITEM_NONE             0
#define ITEM_POTION           13
`);

  fs.writeFileSync(path.join(root, "include/constants/flags.h"), `
#define FLAG_NONE             0
#define FLAG_TEMP_1          1
#define FLAG_ITEM_POTION_1   2
`);

  fs.writeFileSync(path.join(root, "include/constants/vars.h"), `
#define VAR_TEMP_0            0x8000
`);

  fs.writeFileSync(path.join(root, "include/constants/weather.h"), `
#define WEATHER_NONE          0
#define WEATHER_SUNNY         1
#define WEATHER_RAIN          2
`);

  fs.writeFileSync(path.join(root, "include/constants/songs.h"), `
#define MUS_DUMMY             0
`);

  fs.writeFileSync(path.join(root, "include/constants/map_types.h"), `
#define MAP_TYPE_NONE         0
#define MAP_TYPE_TOWN         1
#define MAP_TYPE_ROUTE        3
#define MAP_TYPE_UNDERGROUND   5
#define MAP_BATTLE_SCENE_NORMAL  0
`);

  fs.writeFileSync(path.join(root, "include/constants/trainer_types.h"), `
#define TRAINER_TYPE_NONE     0
#define TRAINER_TYPE_NORMAL   1
`);

  fs.writeFileSync(path.join(root, "include/constants/secret_bases.h"), `
#define SECRET_BASE_RED_CAVE1_1  0
`);

  fs.writeFileSync(path.join(root, "include/constants/event_object_movement.h"), `
#define MOVEMENT_TYPE_NONE         0
#define MOVEMENT_TYPE_FACE_DOWN    1
`);

  fs.writeFileSync(path.join(root, "include/constants/event_objects.h"), `
#define OBJ_EVENT_GFX_YOUNGSTER    0
#define OBJ_EVENT_GFX_LASS         1
`);

  fs.writeFileSync(path.join(root, "include/constants/event_bg.h"), `
#define BG_EVENT_PLAYER_FACING_ANY   0
`);

  fs.writeFileSync(path.join(root, "include/constants/metatile_behaviors.h"), `
#define MB_NORMAL         0
`);

  fs.writeFileSync(path.join(root, "include/constants/metatile_labels.h"), `
#define METATILE_General_Grass        0x001
`);

  // --- tileset headers ---
  const tilesetHeaders = `
const struct Tileset gTileset_General = {
    .isCompressed = TRUE,
    .isSecondary = FALSE,
};
const struct Tileset gTileset_Petalburg = {
    .isCompressed = TRUE,
    .isSecondary = TRUE,
};
const struct Tileset gTileset_Route101 = {
    .isCompressed = TRUE,
    .isSecondary = TRUE,
};
const struct Tileset gTileset_Cave = {
    .isCompressed = TRUE,
    .isSecondary = TRUE,
};
`;
  fs.writeFileSync(path.join(root, "src/data/tilesets/headers.h"), tilesetHeaders);

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

export function createTestProject(): TestProject {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "porymap-test-"));

  // --- Directory structure ---
  const dirs = [
    "data/maps/PetalburgCity",
    "data/maps/Route101",
    "data/layouts/PetalburgCity",
    "data/layouts/Route101",
    "src/data",
    "include/constants",
    "src/data/tilesets",
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(root, d), { recursive: true });
  }

  // --- map_groups.json ---
  const mapGroups = {
    group_order: ["gMapGroup_Towns", "gMapGroup_Routes"],
    gMapGroup_Towns: ["PetalburgCity"],
    gMapGroup_Routes: ["Route101"],
  };
  fs.writeFileSync(
    path.join(root, "data/maps/map_groups.json"),
    JSON.stringify(mapGroups, null, 4),
  );

  // --- layouts.json ---
  const layouts = {
    layouts_table_label: "gMapLayouts",
    layouts: [
      {
        id: "LAYOUT_PETALBURG_CITY",
        name: "PetalburgCity",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Petalburg",
        border_filepath: "data/layouts/PetalburgCity/border.bin",
        blockdata_filepath: "data/layouts/PetalburgCity/map.bin",
      },
      {
        id: "LAYOUT_ROUTE101",
        name: "Route101",
        width: 4,
        height: 4,
        border_width: 2,
        border_height: 2,
        primary_tileset: "gTileset_General",
        secondary_tileset: "gTileset_Route101",
        border_filepath: "data/layouts/Route101/border.bin",
        blockdata_filepath: "data/layouts/Route101/map.bin",
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, "data/layouts/layouts.json"),
    JSON.stringify(layouts, null, 4),
  );

  // --- blockdata files ---
  const mapBin = makeBlockdata(1);
  const borderBin = makeBorderdata(2);
  fs.writeFileSync(path.join(root, "data/layouts/PetalburgCity/map.bin"), mapBin);
  fs.writeFileSync(path.join(root, "data/layouts/PetalburgCity/border.bin"), borderBin);
  fs.writeFileSync(path.join(root, "data/layouts/Route101/map.bin"), mapBin);
  fs.writeFileSync(path.join(root, "data/layouts/Route101/border.bin"), borderBin);

  // --- map.json files ---
  fs.writeFileSync(
    path.join(root, "data/maps/PetalburgCity/map.json"),
    JSON.stringify(mapJson("PetalburgCity", MAP_PETALBURG_CONST, "LAYOUT_PETALBURG_CITY"), null, 4),
  );
  fs.writeFileSync(
    path.join(root, "data/maps/Route101/map.json"),
    JSON.stringify(mapJson("Route101", MAP_ROUTE101_CONST, "LAYOUT_ROUTE101"), null, 4),
  );

  // --- wild_encounters.json ---
  const wildEncounters = {
    wild_encounter_groups: [
      {
        label: "gWildMonHeaders",
        for_maps: true,
        fields: [
          {
            type: "land",
            encounter_rates: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
            groups: {},
          },
          {
            type: "water",
            encounter_rates: [60, 30, 5, 4, 1],
            groups: {},
          },
        ],
        encounters: [
          {
            map: MAP_ROUTE101_CONST,
            base_label: "gRoute101WildMons",
            land: {
              encounter_rate: 20,
              mons: [
                { min_level: 2, max_level: 3, species: "SPECIES_ZIGZAGOON" },
                { min_level: 2, max_level: 3, species: "SPECIES_WURMPLE" },
                { min_level: 3, max_level: 4, species: "SPECIES_ZIGZAGOON" },
                { min_level: 3, max_level: 4, species: "SPECIES_WURMPLE" },
                { min_level: 2, max_level: 5, species: "SPECIES_ZIGZAGOON" },
                { min_level: 2, max_level: 5, species: "SPECIES_WURMPLE" },
                { min_level: 5, max_level: 5, species: "SPECIES_ZIGZAGOON" },
                { min_level: 5, max_level: 5, species: "SPECIES_POOCHYENA" },
                { min_level: 4, max_level: 4, species: "SPECIES_POOCHYENA" },
                { min_level: 4, max_level: 5, species: "SPECIES_POOCHYENA" },
                { min_level: 3, max_level: 3, species: "SPECIES_POOCHYENA" },
                { min_level: 3, max_level: 5, species: "SPECIES_POOCHYENA" },
              ],
            },
          },
        ],
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, "src/data/wild_encounters.json"),
    JSON.stringify(wildEncounters, null, 4),
  );

  // --- heal_locations.json ---
  const healLocations = {
    heal_locations: [
      {
        id: "HEAL_LOCATION_PETALBURG_CITY",
        map: MAP_PETALBURG_CONST,
        x: 6,
        y: 8,
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, "src/data/heal_locations.json"),
    JSON.stringify(healLocations, null, 4),
  );

  // --- constants headers ---
  const speciesHeader = `
#ifndef GUARD_CONSTANTS_SPECIES_H
#define GUARD_CONSTANTS_SPECIES_H

#define SPECIES_NONE            0
#define SPECIES_BULBASAUR       1
#define SPECIES_IVYSAUR         2
#define SPECIES_ZIGZAGOON     263
#define SPECIES_WURMPLE       265
#define SPECIES_POOCHYENA     261
#define SPECIES_PIKACHU        25

#endif
`;
  fs.writeFileSync(path.join(root, "include/constants/species.h"), speciesHeader);

  const itemsHeader = `
#define ITEM_NONE             0
#define ITEM_POTION           13
#define ITEM_RARE_CANDY      50
`;
  fs.writeFileSync(path.join(root, "include/constants/items.h"), itemsHeader);

  const flagsHeader = `
#define FLAG_NONE             0
#define FLAG_DEFEATED_RIVAL   1
#define FLAG_OBTAINED_ITEM_2  2
`;
  fs.writeFileSync(path.join(root, "include/constants/flags.h"), flagsHeader);

  const varsHeader = `
#define VAR_TEMP_0            0x8000
#define VAR_RIVAL_STATE       0x4001
`;
  fs.writeFileSync(path.join(root, "include/constants/vars.h"), varsHeader);

  const weatherHeader = `
#define WEATHER_NONE          0
#define WEATHER_SUNNY         1
#define WEATHER_RAIN          2
`;
  fs.writeFileSync(path.join(root, "include/constants/weather.h"), weatherHeader);

  const songsHeader = `
#define MUS_DUMMY             0
#define MUS_PETALBURG         1
#define SE_DOOR               2
`;
  fs.writeFileSync(path.join(root, "include/constants/songs.h"), songsHeader);

  const mapTypesHeader = `
#define MAP_TYPE_NONE         0
#define MAP_TYPE_TOWN         1
#define MAP_TYPE_CITY         2
#define MAP_BATTLE_SCENE_NORMAL  0
#define MAP_BATTLE_SCENE_GYM  1
`;
  fs.writeFileSync(path.join(root, "include/constants/map_types.h"), mapTypesHeader);

  const trainerTypesHeader = `
#define TRAINER_TYPE_NONE     0
#define TRAINER_TYPE_NORMAL   1
`;
  fs.writeFileSync(path.join(root, "include/constants/trainer_types.h"), trainerTypesHeader);

  const secretBasesHeader = `
#define SECRET_BASE_TREE_1    0
#define SECRET_BASE_CAVE_1    1
`;
  fs.writeFileSync(path.join(root, "include/constants/secret_bases.h"), secretBasesHeader);

  const movementHeader = `
#define MOVEMENT_TYPE_NONE         0
#define MOVEMENT_TYPE_FACE_DOWN    1
#define MOVEMENT_TYPE_WANDER       2
`;
  fs.writeFileSync(
    path.join(root, "include/constants/event_object_movement.h"),
    movementHeader,
  );

  const objEventsHeader = `
#define OBJ_EVENT_GFX_YOUNGSTER    0
#define OBJ_EVENT_GFX_LASS         1
`;
  fs.writeFileSync(path.join(root, "include/constants/event_objects.h"), objEventsHeader);

  const bgEventsHeader = `
#define BG_EVENT_PLAYER_FACING_ANY   0
#define BG_EVENT_PLAYER_FACING_NORTH 1
`;
  fs.writeFileSync(path.join(root, "include/constants/event_bg.h"), bgEventsHeader);

  const metatileBehaviorsHeader = `
#define MB_NORMAL         0
#define MB_IMPASSABLE     1
#define MB_WALKABLE       2
`;
  fs.writeFileSync(
    path.join(root, "include/constants/metatile_behaviors.h"),
    metatileBehaviorsHeader,
  );

  const metatileLabelsHeader = `
#define METATILE_General_Grass        0x001
#define METATILE_General_Water        0x002
#define METATILE_Petalburg_FlowerBed  0x101
`;
  fs.writeFileSync(
    path.join(root, "include/constants/metatile_labels.h"),
    metatileLabelsHeader,
  );

  // Tileset headers (C format)
  const tilesetHeaders = `
const struct Tileset gTileset_General = {
    .isCompressed = TRUE,
    .isSecondary = FALSE,
};

const struct Tileset gTileset_Petalburg = {
    .isCompressed = TRUE,
    .isSecondary = TRUE,
};

const struct Tileset gTileset_Route101 = {
    .isCompressed = TRUE,
    .isSecondary = TRUE,
};
`;
  fs.writeFileSync(path.join(root, "src/data/tilesets/headers.h"), tilesetHeaders);

  return {
    root,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}
