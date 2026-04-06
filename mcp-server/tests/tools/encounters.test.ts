/**
 * Integration tests for wild encounter operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import {
  readWildEncounters,
  writeWildEncounters,
  getEncountersForMap,
  getEncounterFieldDefs,
  setFieldEncounters,
  removeFieldEncounters,
  findMapsWithSpecies,
} from "../../src/data/wild-encounters.js";
import { createTestProject, MAP_ROUTE101_CONST, MAP_PETALBURG_CONST } from "../helpers.js";
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

describe("get_wild_encounters equivalent", () => {
  it("reads encounters for a map", () => {
    const data = project.readWildEncounters()!;
    const entry = getEncountersForMap(data, MAP_ROUTE101_CONST);
    expect(entry).toBeDefined();
    expect((entry as Record<string, unknown>).land).toBeDefined();
  });

  it("returns undefined for map without encounters", () => {
    const data = project.readWildEncounters()!;
    expect(getEncountersForMap(data, MAP_PETALBURG_CONST)).toBeUndefined();
  });
});

describe("get_encounter_fields equivalent", () => {
  it("returns field definitions", () => {
    const data = project.readWildEncounters()!;
    const defs = getEncounterFieldDefs(data);
    expect(defs.length).toBeGreaterThan(0);
    expect(defs.find((d) => d.type === "land")).toBeDefined();
    expect(defs.find((d) => d.type === "water")).toBeDefined();
  });
});

describe("set_wild_encounters equivalent", () => {
  it("sets encounter data and persists to file", () => {
    const filepath = project.resolve(project.paths.json_wild_encounters);
    const data = readWildEncounters(filepath);
    const waterMons = Array(5).fill({ min_level: 20, max_level: 30, species: "SPECIES_MARILL" });
    setFieldEncounters(data, MAP_ROUTE101_CONST, "gRoute101WildMons", "water", 10, waterMons);
    writeWildEncounters(filepath, data);

    const reread = readWildEncounters(filepath);
    const entry = getEncountersForMap(reread, MAP_ROUTE101_CONST)!;
    const waterData = (entry as Record<string, unknown>).water as { encounter_rate: number; mons: unknown[] };
    expect(waterData.encounter_rate).toBe(10);
    expect(waterData.mons).toHaveLength(5);
  });

  it("creates a new map entry if not present", () => {
    const filepath = project.resolve(project.paths.json_wild_encounters);
    const data = readWildEncounters(filepath);
    const landMons = Array(12).fill({ min_level: 5, max_level: 10, species: "SPECIES_ZIGZAGOON" });
    setFieldEncounters(data, MAP_PETALBURG_CONST, "gPetalburgCityWildMons", "land", 5, landMons);
    writeWildEncounters(filepath, data);

    const reread = readWildEncounters(filepath);
    expect(getEncountersForMap(reread, MAP_PETALBURG_CONST)).toBeDefined();
  });
});

describe("remove_wild_encounters equivalent", () => {
  it("removes a field type from map encounters", () => {
    const filepath = project.resolve(project.paths.json_wild_encounters);
    const data = readWildEncounters(filepath);
    const removed = removeFieldEncounters(data, MAP_ROUTE101_CONST, "land");
    expect(removed).toBe(true);
    writeWildEncounters(filepath, data);

    const reread = readWildEncounters(filepath);
    expect(getEncountersForMap(reread, MAP_ROUTE101_CONST)).toBeUndefined();
  });

  it("returns false for non-existent field", () => {
    const filepath = project.resolve(project.paths.json_wild_encounters);
    const data = readWildEncounters(filepath);
    expect(removeFieldEncounters(data, MAP_ROUTE101_CONST, "fishing")).toBe(false);
  });
});

describe("find_maps_using_species equivalent", () => {
  it("finds maps containing a species", () => {
    const data = project.readWildEncounters()!;
    const results = findMapsWithSpecies(data, "SPECIES_ZIGZAGOON");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].map).toBe(MAP_ROUTE101_CONST);
  });

  it("returns empty for species not in any encounter", () => {
    const data = project.readWildEncounters()!;
    const results = findMapsWithSpecies(data, "SPECIES_MEWTWO");
    expect(results).toEqual([]);
  });
});
