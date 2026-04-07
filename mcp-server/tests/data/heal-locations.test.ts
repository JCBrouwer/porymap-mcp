import { describe, it, expect } from "vitest";
import {
  getHealLocationsForMap,
  setHealLocation,
  removeHealLocation,
} from "../../src/data/heal-locations.js";
import type { HealLocationsJson } from "../../src/types.js";

function makeData(): HealLocationsJson {
  return {
    heal_locations: [
      { id: "HEAL_LOCATION_PETALBURG", map: "MAP_PETALBURG_CITY", x: 6, y: 8 },
      { id: "HEAL_LOCATION_LITTLEROOT", map: "MAP_LITTLEROOT_TOWN", x: 4, y: 3 },
    ],
  };
}

describe("getHealLocationsForMap", () => {
  it("filters by map constant", () => {
    const data = makeData();
    const locs = getHealLocationsForMap(data, "MAP_PETALBURG_CITY");
    expect(locs).toHaveLength(1);
    expect(locs[0].id).toBe("HEAL_LOCATION_PETALBURG");
  });

  it("returns empty array for unknown map", () => {
    const data = makeData();
    expect(getHealLocationsForMap(data, "MAP_UNKNOWN")).toEqual([]);
  });
});

describe("setHealLocation", () => {
  it("updates an existing entry by id", () => {
    const data = makeData();
    setHealLocation(data, { id: "HEAL_LOCATION_PETALBURG", map: "MAP_PETALBURG_CITY", x: 10, y: 12 });
    const locs = getHealLocationsForMap(data, "MAP_PETALBURG_CITY");
    expect(locs[0].x).toBe(10);
    expect(locs[0].y).toBe(12);
    expect(data.heal_locations).toHaveLength(2); // not added, just updated
  });

  it("inserts a new entry when id not found", () => {
    const data = makeData();
    setHealLocation(data, { id: "HEAL_LOCATION_NEW", map: "MAP_NEW_TOWN", x: 5, y: 7 });
    expect(data.heal_locations).toHaveLength(3);
    expect(getHealLocationsForMap(data, "MAP_NEW_TOWN")[0].id).toBe("HEAL_LOCATION_NEW");
  });

  it("preserves custom fields from existing entry", () => {
    const data: HealLocationsJson = {
      heal_locations: [
        { id: "HEAL_LOCATION_PETALBURG", map: "MAP_PETALBURG_CITY", x: 6, y: 8, custom_field: "preserved" },
      ],
    };
    setHealLocation(data, { id: "HEAL_LOCATION_PETALBURG", map: "MAP_PETALBURG_CITY", x: 1, y: 1 });
    expect((data.heal_locations[0] as Record<string, unknown>).custom_field).toBe("preserved");
  });

  it("adds respawn_map and respawn_npc fields when provided", () => {
    const data = makeData();
    setHealLocation(data, {
      id: "HEAL_LOCATION_NEW",
      map: "MAP_NEW",
      x: 0,
      y: 0,
      respawn_map: "MAP_LITTLEROOT_TOWN",
      respawn_npc: "1",
    });
    const entry = data.heal_locations.find((l) => l.id === "HEAL_LOCATION_NEW")!;
    expect(entry.respawn_map).toBe("MAP_LITTLEROOT_TOWN");
    expect(entry.respawn_npc).toBe("1");
  });
});

describe("removeHealLocation", () => {
  it("removes an entry by id", () => {
    const data = makeData();
    const result = removeHealLocation(data, "HEAL_LOCATION_PETALBURG");
    expect(result).toBe(true);
    expect(data.heal_locations).toHaveLength(1);
    expect(data.heal_locations[0].id).toBe("HEAL_LOCATION_LITTLEROOT");
  });

  it("returns false for unknown id", () => {
    const data = makeData();
    expect(removeHealLocation(data, "HEAL_LOCATION_MISSING")).toBe(false);
    expect(data.heal_locations).toHaveLength(2); // unchanged
  });
});
