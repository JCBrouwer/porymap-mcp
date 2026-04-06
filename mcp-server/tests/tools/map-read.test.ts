/**
 * Integration tests for map read operations via ProjectContext + data modules.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import { getMapHeader, getAllEvents, getConnections } from "../../src/data/map-json.js";
import { readMapBlocks, readMapBlockRegion, readBorderBlocks } from "../../src/data/layouts.js";
import { createTestProject } from "../helpers.js";
import type { TestProject } from "../helpers.js";

let tp: TestProject;
let project: ProjectContext;

beforeEach(() => {
  tp = createTestProject();
  project = new ProjectContext(tp.root);
});

afterEach(() => {
  tp.cleanup();
});

describe("get_map_header equivalent", () => {
  it("returns header fields without events", () => {
    const mapData = project.readMapJson("PetalburgCity");
    const header = getMapHeader(mapData);
    expect(header.id).toBe("MAP_PETALBURG_CITY");
    expect(header.music).toBe("MUS_DUMMY");
    expect(header.weather).toBe("WEATHER_NONE");
    expect((header as Record<string, unknown>).object_events).toBeUndefined();
  });
});

describe("get_map_blocks equivalent", () => {
  it("reads full map blocks", () => {
    const { layout } = project.getLayoutForMap("PetalburgCity");
    const blocks = readMapBlocks(project.root, layout);
    expect(blocks.length).toBe(16); // 4x4
    expect(blocks[0]).toMatchObject({ x: 0, y: 0, metatileId: 1 });
  });

  it("reads a region of blocks", () => {
    const { layout } = project.getLayoutForMap("PetalburgCity");
    const region = readMapBlockRegion(project.root, layout, 1, 1, 2, 2);
    expect(region.length).toBe(4);
    expect(region[0]).toMatchObject({ x: 1, y: 1 });
  });

  it("clips region to map bounds", () => {
    const { layout } = project.getLayoutForMap("PetalburgCity");
    // Request a huge region
    const region = readMapBlockRegion(project.root, layout, 3, 3, 100, 100);
    expect(region.length).toBe(1); // only (3,3) valid
  });
});

describe("get_map_border equivalent", () => {
  it("reads border blocks", () => {
    const { layout } = project.getLayoutForMap("PetalburgCity");
    const border = readBorderBlocks(project.root, layout);
    expect(border.length).toBe(4); // 2x2
    expect(border[0]).toMatchObject({ x: 0, y: 0, metatileId: 2 });
  });
});

describe("get_map_events equivalent", () => {
  it("returns all event groups", () => {
    const mapData = project.readMapJson("PetalburgCity");
    const events = getAllEvents(mapData);
    expect(events.object_events).toHaveLength(1);
    expect(events.warp_events).toHaveLength(1);
    expect(events.coord_events).toHaveLength(1);
    expect(events.bg_events).toHaveLength(1);
  });

  it("object event has expected fields", () => {
    const mapData = project.readMapJson("PetalburgCity");
    const obj = mapData.object_events[0];
    expect(obj.graphics_id).toBe("OBJ_EVENT_GFX_YOUNGSTER");
    expect(obj.x).toBe(3);
    expect(obj.y).toBe(5);
  });
});

describe("get_map_connections equivalent", () => {
  it("returns empty connections array for test map", () => {
    const mapData = project.readMapJson("PetalburgCity");
    const connections = getConnections(mapData);
    expect(connections).toEqual([]);
  });
});
