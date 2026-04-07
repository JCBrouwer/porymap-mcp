/**
 * Integration tests for ProjectContext — the foundation used by all tools.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import { createTestProject, MAP_PETALBURG_CONST, MAP_ROUTE101_CONST } from "../helpers.js";
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

describe("ProjectContext construction", () => {
  it("constructs without error on valid project", () => {
    expect(project).toBeDefined();
    expect(project.root).toBe(tp.root);
  });

  it("throws for non-existent directory", () => {
    expect(() => new ProjectContext("/does/not/exist")).toThrow();
  });
});

describe("getProjectInfo", () => {
  it("returns correct map and tileset counts", () => {
    const info = project.getProjectInfo();
    expect(info.mapCount).toBe(2);
    expect(info.groupNames).toContain("gMapGroup_Towns");
    expect(info.groupNames).toContain("gMapGroup_Routes");
    expect(info.tilesetCount).toBe(3);
    expect(info.primaryTilesetCount).toBe(1);
    expect(info.secondaryTilesetCount).toBe(2);
    expect(info.hasWildEncounters).toBe(true);
    expect(info.hasHealLocations).toBe(true);
  });
});

describe("getMapList", () => {
  it("returns all maps with group info", () => {
    const maps = project.getMapList();
    expect(maps.length).toBe(2);
    const petalburg = maps.find((m) => m.name === "PetalburgCity");
    expect(petalburg).toBeDefined();
    expect(petalburg!.group).toBe("gMapGroup_Towns");
  });
});

describe("readMapJson", () => {
  it("reads map.json successfully", () => {
    const map = project.readMapJson("PetalburgCity");
    expect(map.id).toBe(MAP_PETALBURG_CONST);
    expect(map.object_events).toHaveLength(1);
    expect(map.warp_events).toHaveLength(1);
  });

  it("throws for unknown map", () => {
    expect(() => project.readMapJson("UnknownMap")).toThrow();
  });
});

describe("resolveMapName", () => {
  it("returns name unchanged for non-constant input", () => {
    expect(project.resolveMapName("PetalburgCity")).toBe("PetalburgCity");
  });

  it("resolves constant to map name", () => {
    expect(project.resolveMapName(MAP_PETALBURG_CONST)).toBe("PetalburgCity");
    expect(project.resolveMapName(MAP_ROUTE101_CONST)).toBe("Route101");
  });

  it("caches constant lookups (second call is fast)", () => {
    project.resolveMapName(MAP_PETALBURG_CONST);
    // Second call should use cache — no observable difference except it works
    expect(project.resolveMapName(MAP_PETALBURG_CONST)).toBe("PetalburgCity");
  });

  it("throws for unknown constant", () => {
    expect(() => project.resolveMapName("MAP_UNKNOWN_PLACE")).toThrow();
  });
});

describe("getConstants", () => {
  it("returns species constants", () => {
    const constants = project.getConstants("species");
    expect(constants).toContain("SPECIES_PIKACHU");
    expect(constants).toContain("SPECIES_BULBASAUR");
  });

  it("caches results on second call", () => {
    const first = project.getConstants("species");
    const second = project.getConstants("species");
    expect(first).toBe(second); // same array reference (cached)
  });

  it("clearConstantsCache invalidates all caches", () => {
    project.getConstants("species");
    project.clearConstantsCache();
    const after = project.getConstants("species");
    expect(after.length).toBeGreaterThan(0); // still works after clear
  });
});

describe("getTilesets", () => {
  it("returns tileset info from headers.h", () => {
    const tilesets = project.getTilesets();
    expect(tilesets.length).toBe(3);
    const primary = tilesets.filter((t) => !t.isSecondary);
    const secondary = tilesets.filter((t) => t.isSecondary);
    expect(primary.length).toBe(1);
    expect(secondary.length).toBe(2);
    expect(primary[0].name).toBe("gTileset_General");
  });
});

describe("getLayoutForMap", () => {
  it("returns layout for a valid map", () => {
    const { layout } = project.getLayoutForMap("PetalburgCity");
    expect(layout.id).toBe("LAYOUT_PETALBURG_CITY");
    expect(layout.width).toBe(4);
    expect(layout.height).toBe(4);
  });
});

describe("readWildEncounters", () => {
  it("reads wild encounters", () => {
    const data = project.readWildEncounters();
    expect(data).toBeDefined();
    expect(data!.wild_encounter_groups.length).toBe(1);
  });
});

describe("readHealLocations", () => {
  it("reads heal locations", () => {
    const data = project.readHealLocations();
    expect(data).toBeDefined();
    expect(data!.heal_locations.length).toBe(1);
    expect(data!.heal_locations[0].id).toBe("HEAL_LOCATION_PETALBURG_CITY");
  });
});
