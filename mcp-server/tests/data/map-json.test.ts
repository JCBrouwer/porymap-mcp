import { describe, it, expect } from "vitest";
import {
  getMapHeader,
  updateMapHeader,
  getConnections,
  addConnection,
  updateConnection,
  removeConnection,
  reverseDirection,
  getAllEvents,
  addObjectEvent,
  addWarpEvent,
  addCoordEvent,
  addBgEvent,
  updateEvent,
  removeEvent,
  createDefaultMapJson,
} from "../../src/data/map-json.js";
import type { MapJson } from "../../src/types.js";

function makeMap(overrides: Partial<MapJson> = {}): MapJson {
  return {
    id: "MAP_TEST",
    name: "TestMap",
    layout: "LAYOUT_TEST",
    music: "MUS_DUMMY",
    region_map_section: "MAPSEC_NONE",
    requires_flash: false,
    weather: "WEATHER_NONE",
    map_type: "MAP_TYPE_TOWN",
    show_map_name: true,
    battle_scene: "MAP_BATTLE_SCENE_NORMAL",
    connections: [],
    object_events: [],
    warp_events: [],
    coord_events: [],
    bg_events: [],
    ...overrides,
  };
}

describe("getMapHeader", () => {
  it("returns header fields without event arrays", () => {
    const map = makeMap();
    const header = getMapHeader(map);
    expect(header.id).toBe("MAP_TEST");
    expect(header.music).toBe("MUS_DUMMY");
    expect((header as MapJson).object_events).toBeUndefined();
    expect((header as MapJson).warp_events).toBeUndefined();
    expect((header as MapJson).connections).toBeUndefined();
  });

  it("includes custom fields", () => {
    const map = makeMap({ custom_field: "hello" } as Partial<MapJson>);
    const header = getMapHeader(map);
    expect((header as Record<string, unknown>).custom_field).toBe("hello");
  });
});

describe("updateMapHeader", () => {
  it("updates standard fields", () => {
    const map = makeMap();
    updateMapHeader(map, { music: "MUS_PETALBURG", weather: "WEATHER_RAIN" });
    expect(map.music).toBe("MUS_PETALBURG");
    expect(map.weather).toBe("WEATHER_RAIN");
  });

  it("allows updating custom fields (no whitelist)", () => {
    const map = makeMap();
    updateMapHeader(map, { my_custom_field: 42 });
    expect((map as Record<string, unknown>).my_custom_field).toBe(42);
  });

  it("skips undefined values", () => {
    const map = makeMap();
    updateMapHeader(map, { music: undefined });
    expect(map.music).toBe("MUS_DUMMY"); // unchanged
  });
});

describe("connections", () => {
  it("addConnection appends to connections array", () => {
    const map = makeMap();
    addConnection(map, { map: "MAP_ROUTE101", direction: "up", offset: 0 });
    expect(map.connections).toHaveLength(1);
    expect(map.connections![0].direction).toBe("up");
  });

  it("addConnection creates array if missing", () => {
    const map = makeMap({ connections: undefined });
    addConnection(map, { map: "MAP_ROUTE101", direction: "down", offset: 5 });
    expect(map.connections).toHaveLength(1);
  });

  it("updateConnection modifies existing connection", () => {
    const map = makeMap();
    addConnection(map, { map: "MAP_ROUTE101", direction: "up", offset: 0 });
    updateConnection(map, 0, { offset: 10 });
    expect(map.connections![0].offset).toBe(10);
    expect(map.connections![0].direction).toBe("up"); // unchanged
  });

  it("updateConnection throws for out-of-range index", () => {
    const map = makeMap();
    expect(() => updateConnection(map, 0, { offset: 1 })).toThrow();
  });

  it("removeConnection deletes by index", () => {
    const map = makeMap();
    addConnection(map, { map: "MAP_ROUTE101", direction: "up", offset: 0 });
    addConnection(map, { map: "MAP_ROUTE104", direction: "down", offset: 0 });
    removeConnection(map, 0);
    expect(map.connections).toHaveLength(1);
    expect(map.connections![0].map).toBe("MAP_ROUTE104");
  });

  it("getConnections returns empty array when undefined", () => {
    const map = makeMap({ connections: undefined });
    expect(getConnections(map)).toEqual([]);
  });
});

describe("reverseDirection", () => {
  it("reverses cardinal directions", () => {
    expect(reverseDirection("up")).toBe("down");
    expect(reverseDirection("down")).toBe("up");
    expect(reverseDirection("left")).toBe("right");
    expect(reverseDirection("right")).toBe("left");
    expect(reverseDirection("dive")).toBe("emerge");
    expect(reverseDirection("emerge")).toBe("dive");
  });

  it("returns null for unknown directions", () => {
    expect(reverseDirection("diagonal")).toBeNull();
  });
});

describe("events", () => {
  it("addObjectEvent appends and returns index", () => {
    const map = makeMap();
    const idx = addObjectEvent(map, {
      graphics_id: "OBJ_EVENT_GFX_YOUNGSTER",
      x: 1,
      y: 2,
      elevation: 3,
      movement_type: "MOVEMENT_TYPE_FACE_DOWN",
      movement_range_x: 0,
      movement_range_y: 0,
      trainer_type: "TRAINER_TYPE_NONE",
      trainer_sight_or_berry_tree_id: "0",
      script: "TestScript",
      flag: "0",
    });
    expect(idx).toBe(0);
    expect(map.object_events).toHaveLength(1);
  });

  it("addWarpEvent appends and returns index", () => {
    const map = makeMap();
    const idx = addWarpEvent(map, { x: 3, y: 4, elevation: 0, dest_map: "MAP_ROUTE101", dest_warp_id: "0" });
    expect(idx).toBe(0);
    expect(map.warp_events).toHaveLength(1);
  });

  it("addCoordEvent appends trigger", () => {
    const map = makeMap();
    addCoordEvent(map, { type: "trigger", x: 0, y: 0, elevation: 0, var: "VAR_TEMP", var_value: "1", script: "Sc" });
    expect(map.coord_events[0].type).toBe("trigger");
  });

  it("addBgEvent appends sign", () => {
    const map = makeMap();
    addBgEvent(map, { type: "sign", x: 1, y: 1, elevation: 0, player_facing_dir: "BG_EVENT_PLAYER_FACING_ANY", script: "S" });
    expect(map.bg_events[0].type).toBe("sign");
  });

  it("updateEvent modifies an event by group and index", () => {
    const map = makeMap();
    addObjectEvent(map, {
      graphics_id: "OBJ_EVENT_GFX_LASS",
      x: 0, y: 0, elevation: 3,
      movement_type: "MOVEMENT_TYPE_FACE_DOWN",
      movement_range_x: 0, movement_range_y: 0,
      trainer_type: "TRAINER_TYPE_NONE",
      trainer_sight_or_berry_tree_id: "0",
      script: "OldScript",
      flag: "0",
    });
    updateEvent(map, "object", 0, { script: "NewScript" });
    expect(map.object_events[0].script).toBe("NewScript");
  });

  it("updateEvent throws for out-of-range index", () => {
    const map = makeMap();
    expect(() => updateEvent(map, "object", 0, { script: "x" })).toThrow();
  });

  it("removeEvent deletes by group and index", () => {
    const map = makeMap();
    addWarpEvent(map, { x: 0, y: 0, elevation: 0, dest_map: "MAP_A", dest_warp_id: "0" });
    addWarpEvent(map, { x: 1, y: 1, elevation: 0, dest_map: "MAP_B", dest_warp_id: "1" });
    removeEvent(map, "warp", 0);
    expect(map.warp_events).toHaveLength(1);
    expect(map.warp_events[0].dest_map).toBe("MAP_B");
  });

  it("getAllEvents returns all arrays including empty", () => {
    const map = makeMap();
    const all = getAllEvents(map);
    expect(all.object_events).toEqual([]);
    expect(all.warp_events).toEqual([]);
    expect(all.coord_events).toEqual([]);
    expect(all.bg_events).toEqual([]);
  });
});

describe("createDefaultMapJson", () => {
  it("creates a map with defaults", () => {
    const map = createDefaultMapJson("TestMap", "MAP_TEST_MAP", "LAYOUT_TEST_MAP");
    expect(map.id).toBe("MAP_TEST_MAP");
    expect(map.music).toBe("MUS_DUMMY");
    expect(map.weather).toBe("WEATHER_NONE");
    expect(map.object_events).toEqual([]);
  });

  it("applies allow_* options", () => {
    const map = createDefaultMapJson("TestMap", "MAP_TEST", "LAYOUT_TEST", {
      allowRunning: true,
      allowBiking: false,
      allowEscaping: true,
    });
    expect(map.allow_running).toBe(true);
    expect(map.allow_cycling).toBe(false);
    expect(map.allow_escaping).toBe(true);
  });

  it("does not set allow_* fields when not provided", () => {
    const map = createDefaultMapJson("TestMap", "MAP_TEST", "LAYOUT_TEST");
    expect(map.allow_running).toBeUndefined();
    expect(map.allow_cycling).toBeUndefined();
    expect(map.allow_escaping).toBeUndefined();
  });

  it("applies music and weather options", () => {
    const map = createDefaultMapJson("TestMap", "MAP_TEST", "LAYOUT_TEST", {
      music: "MUS_PETALBURG",
      weather: "WEATHER_RAIN",
    });
    expect(map.music).toBe("MUS_PETALBURG");
    expect(map.weather).toBe("WEATHER_RAIN");
  });
});
