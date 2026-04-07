import { describe, it, expect } from "vitest";
import {
  getMainEncounterGroup,
  getEncounterFieldDefs,
  getEncountersForMap,
  getFieldEncounters,
  setFieldEncounters,
  removeFieldEncounters,
  findMapsWithSpecies,
} from "../../src/data/wild-encounters.js";
import type { WildEncountersJson } from "../../src/types.js";

function makeEncountersJson(): WildEncountersJson {
  return {
    wild_encounter_groups: [
      {
        label: "gWildMonHeaders",
        for_maps: true,
        fields: [
          {
            type: "land",
            encounter_rates: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
          },
          {
            type: "water",
            encounter_rates: [60, 30, 5, 4, 1],
          },
        ],
        encounters: [
          {
            map: "MAP_ROUTE101",
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
}

describe("getMainEncounterGroup", () => {
  it("finds the for_maps group", () => {
    const data = makeEncountersJson();
    const group = getMainEncounterGroup(data);
    expect(group).toBeDefined();
    expect(group!.for_maps).toBe(true);
  });

  it("returns undefined when no for_maps group", () => {
    const data: WildEncountersJson = {
      wild_encounter_groups: [{ label: "test", for_maps: false, fields: [], encounters: [] }],
    };
    expect(getMainEncounterGroup(data)).toBeUndefined();
  });
});

describe("getEncounterFieldDefs", () => {
  it("returns field definitions", () => {
    const data = makeEncountersJson();
    const defs = getEncounterFieldDefs(data);
    expect(defs).toHaveLength(2);
    expect(defs[0].type).toBe("land");
    expect(defs[1].type).toBe("water");
  });
});

describe("getEncountersForMap", () => {
  it("finds map entries by constant", () => {
    const data = makeEncountersJson();
    const entry = getEncountersForMap(data, "MAP_ROUTE101");
    expect(entry).toBeDefined();
    expect(entry!.map).toBe("MAP_ROUTE101");
  });

  it("returns undefined for map without encounters", () => {
    const data = makeEncountersJson();
    expect(getEncountersForMap(data, "MAP_MISSING")).toBeUndefined();
  });
});

describe("getFieldEncounters", () => {
  it("returns encounter data for a valid field", () => {
    const data = makeEncountersJson();
    const entry = getEncountersForMap(data, "MAP_ROUTE101")!;
    const field = getFieldEncounters(entry, "land");
    expect(field).toBeDefined();
    expect(field!.encounter_rate).toBe(20);
    expect(field!.mons.length).toBe(12);
  });

  it("returns undefined for missing field type", () => {
    const data = makeEncountersJson();
    const entry = getEncountersForMap(data, "MAP_ROUTE101")!;
    expect(getFieldEncounters(entry, "water")).toBeUndefined();
  });
});

describe("setFieldEncounters", () => {
  it("sets encounters for existing map", () => {
    const data = makeEncountersJson();
    const newMons = Array(12).fill({ min_level: 5, max_level: 10, species: "SPECIES_PIKACHU" });
    setFieldEncounters(data, "MAP_ROUTE101", "gRoute101WildMons", "land", 15, newMons);
    const entry = getEncountersForMap(data, "MAP_ROUTE101")!;
    const field = getFieldEncounters(entry, "land")!;
    expect(field.encounter_rate).toBe(15);
    expect(field.mons[0].species).toBe("SPECIES_PIKACHU");
  });

  it("creates new map entry if not present", () => {
    const data = makeEncountersJson();
    const newMons = Array(12).fill({ min_level: 3, max_level: 7, species: "SPECIES_POOCHYENA" });
    setFieldEncounters(data, "MAP_PETALBURG_CITY", "gPetalburgCityWildMons", "land", 10, newMons);
    const entry = getEncountersForMap(data, "MAP_PETALBURG_CITY");
    expect(entry).toBeDefined();
  });

  it("throws for wrong slot count", () => {
    const data = makeEncountersJson();
    const wrongCount = [{ min_level: 1, max_level: 5, species: "SPECIES_PIKACHU" }]; // 1 slot, needs 12
    expect(() =>
      setFieldEncounters(data, "MAP_ROUTE101", "label", "land", 20, wrongCount),
    ).toThrow(/12 slots/);
  });
});

describe("removeFieldEncounters", () => {
  it("removes a field type from a map", () => {
    const data = makeEncountersJson();
    const removed = removeFieldEncounters(data, "MAP_ROUTE101", "land");
    expect(removed).toBe(true);
    const entry = getEncountersForMap(data, "MAP_ROUTE101");
    // Entry should be gone entirely since it had only 'land'
    expect(entry).toBeUndefined();
  });

  it("returns false for non-existent map", () => {
    const data = makeEncountersJson();
    expect(removeFieldEncounters(data, "MAP_MISSING", "land")).toBe(false);
  });

  it("returns false for non-existent field type", () => {
    const data = makeEncountersJson();
    expect(removeFieldEncounters(data, "MAP_ROUTE101", "water")).toBe(false);
  });

  it("keeps map entry when other field types remain", () => {
    const data = makeEncountersJson();
    // Add a water field first
    const waterMons = Array(5).fill({ min_level: 10, max_level: 20, species: "SPECIES_MARILL" });
    setFieldEncounters(data, "MAP_ROUTE101", "gRoute101WildMons", "water", 10, waterMons);
    // Now remove land
    removeFieldEncounters(data, "MAP_ROUTE101", "land");
    const entry = getEncountersForMap(data, "MAP_ROUTE101");
    expect(entry).toBeDefined(); // still has water
  });
});

describe("findMapsWithSpecies", () => {
  it("finds all maps containing a species", () => {
    const data = makeEncountersJson();
    const results = findMapsWithSpecies(data, "SPECIES_ZIGZAGOON");
    expect(results.length).toBe(1);
    expect(results[0].map).toBe("MAP_ROUTE101");
    expect(results[0].fieldType).toBe("land");
    expect(results[0].slots).toContain(0);
  });

  it("returns empty array when species not found", () => {
    const data = makeEncountersJson();
    const results = findMapsWithSpecies(data, "SPECIES_PIKACHU");
    expect(results).toEqual([]);
  });
});
