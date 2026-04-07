/**
 * Integration tests for event operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import {
  addObjectEvent,
  addWarpEvent,
  addCoordEvent,
  addBgEvent,
  updateEvent,
  removeEvent,
  writeMapJson,
  getAllEvents,
} from "../../src/data/map-json.js";
import { createTestProject, MAP_PETALBURG } from "../helpers.js";
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

describe("add_event — object", () => {
  it("adds an NPC event and persists it", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    const initialCount = mapData.object_events.length;
    addObjectEvent(mapData, {
      graphics_id: "OBJ_EVENT_GFX_LASS",
      x: 5, y: 7, elevation: 3,
      movement_type: "MOVEMENT_TYPE_FACE_DOWN",
      movement_range_x: 0,
      movement_range_y: 0,
      trainer_type: "TRAINER_TYPE_NONE",
      trainer_sight_or_berry_tree_id: "0",
      script: "PetalburgCity_EventScript_Lass",
      flag: "0",
    });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(reread.object_events).toHaveLength(initialCount + 1);
    expect(reread.object_events[reread.object_events.length - 1].graphics_id).toBe("OBJ_EVENT_GFX_LASS");
  });
});

describe("add_event — warp", () => {
  it("adds a warp event and persists it", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    const initialCount = mapData.warp_events.length;
    addWarpEvent(mapData, {
      x: 10, y: 12, elevation: 0,
      dest_map: "MAP_ROUTE101",
      dest_warp_id: "1",
      warp_id: "1",
    });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(reread.warp_events).toHaveLength(initialCount + 1);
    expect(reread.warp_events[reread.warp_events.length - 1].dest_map).toBe("MAP_ROUTE101");
  });
});

describe("add_event — trigger", () => {
  it("adds a coord event (trigger) and persists it", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addCoordEvent(mapData, {
      type: "trigger",
      x: 3, y: 3, elevation: 0,
      var: "VAR_TEMP_0",
      var_value: "1",
      script: "PetalburgCity_EventScript_NewTrigger",
    });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    const trigger = reread.coord_events.find((e) => e.var === "VAR_TEMP_0" && e.var_value === "1");
    expect(trigger).toBeDefined();
  });
});

describe("add_event — sign", () => {
  it("adds a bg event (sign) and persists it", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addBgEvent(mapData, {
      type: "sign",
      x: 2, y: 4, elevation: 0,
      player_facing_dir: "BG_EVENT_PLAYER_FACING_NORTH",
      script: "PetalburgCity_EventScript_NewSign",
    });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    const sign = reread.bg_events.find((e) => e.player_facing_dir === "BG_EVENT_PLAYER_FACING_NORTH");
    expect(sign).toBeDefined();
    expect(sign!.script).toBe("PetalburgCity_EventScript_NewSign");
  });
});

describe("add_event — hidden_item", () => {
  it("adds a hidden item bg event", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addBgEvent(mapData, {
      type: "hidden_item",
      x: 6, y: 6, elevation: 0,
      item: "ITEM_POTION",
      flag: "FLAG_OBTAINED_ITEM_2",
      quantity: 1,
      underfoot: false,
    });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    const hidden = reread.bg_events.find((e) => e.type === "hidden_item");
    expect(hidden).toBeDefined();
    expect(hidden!.item).toBe("ITEM_POTION");
  });
});

describe("update_event", () => {
  it("updates an existing event field", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    updateEvent(mapData, "object", 0, { script: "PetalburgCity_EventScript_Updated" });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(reread.object_events[0].script).toBe("PetalburgCity_EventScript_Updated");
  });

  it("throws for out-of-range index", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    expect(() => updateEvent(mapData, "object", 999, { script: "x" })).toThrow();
  });
});

describe("remove_event", () => {
  it("removes an event by group and index", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    const warpCount = mapData.warp_events.length;
    removeEvent(mapData, "warp", 0);
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(reread.warp_events).toHaveLength(warpCount - 1);
  });
});
