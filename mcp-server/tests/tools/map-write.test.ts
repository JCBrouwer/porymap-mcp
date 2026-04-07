/**
 * Integration tests for map write operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ProjectContext } from "../../src/project.js";
import {
  updateMapHeader,
  writeMapJson,
  createDefaultMapJson,
} from "../../src/data/map-json.js";
import {
  setMapBlocks,
  fillMapBlocks,
  resizeLayout,
  shiftMapBlocks,
  setBorderBlocks,
  readMapBlocks,
  readBorderBlocks,
  writeLayouts,
  createBlockdata,
  addLayout,
} from "../../src/data/layouts.js";
import { addMapToGroup, writeMapGroups } from "../../src/data/map-groups.js";
import { createTestProject, MAP_PETALBURG } from "../helpers.js";
import { mapNameToConstant, layoutNameToConstant, ensureDir, writeJsonFile } from "../../src/utils.js";
import type { TestProject } from "../helpers.js";
import type { Layout } from "../../src/types.js";

let tp: TestProject;
let project: ProjectContext;

beforeEach(() => {
  tp = createTestProject();
  project = new ProjectContext(tp.root);
});

afterEach(() => {
  tp.cleanup();
});

describe("set_map_header equivalent", () => {
  it("updates header fields", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    updateMapHeader(mapData, { music: "MUS_PETALBURG", weather: "WEATHER_RAIN" });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(reread.music).toBe("MUS_PETALBURG");
    expect(reread.weather).toBe("WEATHER_RAIN");
    // Other fields unchanged
    expect(reread.map_type).toBe("MAP_TYPE_TOWN");
  });

  it("allows custom fields (no whitelist)", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    updateMapHeader(mapData, { custom_property: "test_value" });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect((reread as Record<string, unknown>).custom_property).toBe("test_value");
  });
});

describe("set_blocks equivalent", () => {
  it("updates specific blocks on the map", () => {
    const { layout } = project.getLayoutForMap(MAP_PETALBURG);
    setMapBlocks(project.root, layout, [
      { x: 0, y: 0, metatileId: 42, collision: 1, elevation: 5 },
    ]);
    const blocks = readMapBlocks(project.root, layout);
    expect(blocks[0]).toMatchObject({ metatileId: 42, collision: 1, elevation: 5 });
  });
});

describe("fill_region equivalent", () => {
  it("fills a rectangular region with a metatile", () => {
    const { layout } = project.getLayoutForMap(MAP_PETALBURG);
    const count = fillMapBlocks(project.root, layout, 0, 0, 2, 2, 77, 0, 3);
    expect(count).toBe(4);
    const blocks = readMapBlocks(project.root, layout);
    expect(blocks[0]).toMatchObject({ metatileId: 77 });
    expect(blocks[1]).toMatchObject({ metatileId: 77 });
    expect(blocks[4]).toMatchObject({ metatileId: 77 });
    expect(blocks[5]).toMatchObject({ metatileId: 77 });
    expect(blocks[2]).toMatchObject({ metatileId: 1 }); // unchanged
  });
});

describe("resize_map equivalent", () => {
  it("changes map dimensions in layouts.json", () => {
    const { layout, layoutsData } = project.getLayoutForMap(MAP_PETALBURG);
    resizeLayout(project.root, layout, 6, 6);
    layout.width = 6;
    layout.height = 6;
    writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

    const { layout: reread } = project.getLayoutForMap(MAP_PETALBURG);
    expect(reread.width).toBe(6);
    expect(reread.height).toBe(6);
    const blocks = readMapBlocks(project.root, reread);
    expect(blocks.length).toBe(36); // 6x6
  });
});

describe("shift_map equivalent", () => {
  it("shifts blocks and fills edges", () => {
    const { layout } = project.getLayoutForMap(MAP_PETALBURG);
    // Set a distinctive block at (0,0)
    setMapBlocks(project.root, layout, [{ x: 0, y: 0, metatileId: 99, collision: 0, elevation: 3 }]);
    shiftMapBlocks(project.root, layout, 1, 0, 0); // shift right by 1
    const blocks = readMapBlocks(project.root, layout);
    expect(blocks[0]).toMatchObject({ metatileId: 0 }); // (0,0) is now fill
    expect(blocks[1]).toMatchObject({ metatileId: 99 }); // (1,0) was (0,0)
  });
});

describe("set_border equivalent", () => {
  it("updates border blocks", () => {
    const { layout } = project.getLayoutForMap(MAP_PETALBURG);
    setBorderBlocks(project.root, layout, [
      { x: 0, y: 0, metatileId: 55, collision: 0, elevation: 0 },
    ]);
    const border = readBorderBlocks(project.root, layout);
    expect(border[0]).toMatchObject({ metatileId: 55 });
    expect(border[1]).toMatchObject({ metatileId: 2 }); // unchanged
  });
});

describe("set_tilesets equivalent", () => {
  it("updates tileset assignments in layouts.json", () => {
    const { layout, layoutsData } = project.getLayoutForMap(MAP_PETALBURG);
    layout.primary_tileset = "gTileset_General";
    layout.secondary_tileset = "gTileset_Route101";
    writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

    const { layout: reread } = project.getLayoutForMap(MAP_PETALBURG);
    expect(reread.secondary_tileset).toBe("gTileset_Route101");
  });
});

describe("create_map equivalent", () => {
  it("creates all required files and registers the map", () => {
    const mapName = "NewTestTown";
    const mapId = mapNameToConstant(mapName);
    const layoutId = layoutNameToConstant(mapName);

    // Create layout
    const layoutsData = project.readLayouts();
    const layoutFolder = path.join(project.paths.data_layouts_folders, mapName);
    const newLayout: Layout = {
      id: layoutId,
      name: mapName,
      width: 5,
      height: 5,
      border_width: 2,
      border_height: 2,
      primary_tileset: "gTileset_General",
      secondary_tileset: "gTileset_Petalburg",
      border_filepath: path.join(layoutFolder, "border.bin"),
      blockdata_filepath: path.join(layoutFolder, "map.bin"),
    };
    addLayout(layoutsData, newLayout);
    writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

    // Create blockdata files
    createBlockdata(project.root, newLayout, 0, 0);

    // Create map.json with allow_running
    const mapFolder = path.join(project.paths.data_map_folders, mapName);
    ensureDir(project.resolve(mapFolder));
    const mapJson = createDefaultMapJson(mapName, mapId, layoutId, {
      allowRunning: true,
      allowBiking: true,
      allowEscaping: false,
    });
    writeJsonFile(project.resolve(path.join(mapFolder, "map.json")), mapJson);

    // Register in map groups
    const mapGroups = project.readMapGroups();
    addMapToGroup(mapGroups, mapName, "gMapGroup_Towns");
    writeMapGroups(project.resolve(project.paths.json_map_groups), mapGroups);

    // Verify the map was created
    const newProject = new ProjectContext(tp.root);
    const maps = newProject.getMapList();
    expect(maps.find((m) => m.name === mapName)).toBeDefined();

    const createdMap = newProject.readMapJson(mapName);
    expect(createdMap.id).toBe(mapId);
    // Verify allow_* fields were stored
    expect(createdMap.allow_running).toBe(true);
    expect(createdMap.allow_cycling).toBe(true);
    expect(createdMap.allow_escaping).toBe(false);

    // Verify blockdata was created
    const { layout: createdLayout } = newProject.getLayoutForMap(mapName);
    const blocks = readMapBlocks(newProject.root, createdLayout);
    expect(blocks.length).toBe(25); // 5x5
  });
});
