/**
 * Integration tests for heal location operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import {
  readHealLocations,
  writeHealLocations,
  getHealLocationsForMap,
  setHealLocation,
  removeHealLocation,
} from "../../src/data/heal-locations.js";
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

describe("get_heal_locations equivalent", () => {
  it("returns all heal locations", () => {
    const data = project.readHealLocations()!;
    expect(data.heal_locations).toHaveLength(1);
    expect(data.heal_locations[0].id).toBe("HEAL_LOCATION_PETALBURG_CITY");
  });

  it("filters by map constant", () => {
    const data = project.readHealLocations()!;
    const locs = getHealLocationsForMap(data, MAP_PETALBURG_CONST);
    expect(locs).toHaveLength(1);
    expect(locs[0].x).toBe(6);
    expect(locs[0].y).toBe(8);
  });

  it("returns empty for map with no heal location", () => {
    const data = project.readHealLocations()!;
    const locs = getHealLocationsForMap(data, MAP_ROUTE101_CONST);
    expect(locs).toEqual([]);
  });
});

describe("set_heal_location equivalent", () => {
  it("updates existing heal location and persists", () => {
    const filepath = project.resolve(project.paths.json_heal_locations);
    const data = readHealLocations(filepath);
    setHealLocation(data, { id: "HEAL_LOCATION_PETALBURG_CITY", map: MAP_PETALBURG_CONST, x: 10, y: 15 });
    writeHealLocations(filepath, data);

    const reread = readHealLocations(filepath);
    const locs = getHealLocationsForMap(reread, MAP_PETALBURG_CONST);
    expect(locs[0].x).toBe(10);
    expect(locs[0].y).toBe(15);
  });

  it("creates new heal location entry", () => {
    const filepath = project.resolve(project.paths.json_heal_locations);
    const data = readHealLocations(filepath);
    setHealLocation(data, {
      id: "HEAL_LOCATION_ROUTE101",
      map: MAP_ROUTE101_CONST,
      x: 5,
      y: 7,
    });
    writeHealLocations(filepath, data);

    const reread = readHealLocations(filepath);
    expect(reread.heal_locations).toHaveLength(2);
    const locs = getHealLocationsForMap(reread, MAP_ROUTE101_CONST);
    expect(locs[0].id).toBe("HEAL_LOCATION_ROUTE101");
  });

  it("stores respawn_map and respawn_npc (FireRed fields)", () => {
    const filepath = project.resolve(project.paths.json_heal_locations);
    const data = readHealLocations(filepath);
    setHealLocation(data, {
      id: "HEAL_LOCATION_NEW",
      map: MAP_PETALBURG_CONST,
      x: 1,
      y: 1,
      respawn_map: "MAP_LITTLEROOT_TOWN",
      respawn_npc: "1",
    });
    writeHealLocations(filepath, data);

    const reread = readHealLocations(filepath);
    const entry = reread.heal_locations.find((l) => l.id === "HEAL_LOCATION_NEW")!;
    expect(entry.respawn_map).toBe("MAP_LITTLEROOT_TOWN");
    expect(entry.respawn_npc).toBe("1");
  });
});

describe("remove_heal_location equivalent", () => {
  it("removes an existing heal location and persists", () => {
    const filepath = project.resolve(project.paths.json_heal_locations);
    const data = readHealLocations(filepath);
    const removed = removeHealLocation(data, "HEAL_LOCATION_PETALBURG_CITY");
    expect(removed).toBe(true);
    writeHealLocations(filepath, data);

    const reread = readHealLocations(filepath);
    expect(reread.heal_locations).toHaveLength(0);
  });

  it("returns false for unknown id", () => {
    const filepath = project.resolve(project.paths.json_heal_locations);
    const data = readHealLocations(filepath);
    expect(removeHealLocation(data, "HEAL_LOCATION_MISSING")).toBe(false);
    // File should be unchanged
    expect(data.heal_locations).toHaveLength(1);
  });
});
