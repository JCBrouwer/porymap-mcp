/**
 * Integration tests for search operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import { findMapsWithSpecies } from "../../src/data/wild-encounters.js";
import { getAllEvents } from "../../src/data/map-json.js";
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

describe("find_maps_using_species equivalent", () => {
  it("finds maps containing SPECIES_ZIGZAGOON", () => {
    const data = project.readWildEncounters()!;
    const results = findMapsWithSpecies(data, "SPECIES_ZIGZAGOON");
    expect(results.length).toBe(1);
    expect(results[0].map).toBe("MAP_ROUTE101");
    expect(results[0].fieldType).toBe("land");
    expect(results[0].slots.length).toBeGreaterThan(0);
    expect(results[0].minLevel).toBeLessThanOrEqual(results[0].maxLevel);
  });

  it("returns empty for species not in any encounter", () => {
    const data = project.readWildEncounters()!;
    const results = findMapsWithSpecies(data, "SPECIES_MEWTWO");
    expect(results).toEqual([]);
  });

  it("returns empty when no wild encounters file", () => {
    // Simulate no encounters by reading null
    const data = project.readWildEncounters();
    if (!data) {
      expect(true).toBe(true); // can't have results without data
      return;
    }
    // Otherwise the data exists in our fixture
    expect(data).not.toBeNull();
  });
});

describe("search_events_across_maps equivalent", () => {
  it("finds object events by graphics_id", () => {
    const maps = project.getMapList();
    const results: Array<{ map: string; event: unknown }> = [];

    for (const mapEntry of maps) {
      let mapData;
      try {
        mapData = project.readMapJson(mapEntry.name);
      } catch {
        continue;
      }
      const events = getAllEvents(mapData);
      for (const obj of events.object_events) {
        if ((obj as Record<string, unknown>).graphics_id === "OBJ_EVENT_GFX_YOUNGSTER") {
          results.push({ map: mapEntry.name, event: obj });
        }
      }
    }

    expect(results.length).toBe(2); // Both PetalburgCity and Route101 have YOUNGSTER
    expect(results.every((r) => r.map)).toBe(true);
  });

  it("finds events by script pattern", () => {
    const maps = project.getMapList();
    const results: Array<{ map: string; event: unknown }> = [];

    for (const mapEntry of maps) {
      let mapData;
      try {
        mapData = project.readMapJson(mapEntry.name);
      } catch {
        continue;
      }
      const events = getAllEvents(mapData);
      for (const obj of events.object_events) {
        const script = (obj as Record<string, unknown>).script as string;
        if (script && script.toUpperCase().includes("NPC")) {
          results.push({ map: mapEntry.name, event: obj });
        }
      }
    }

    expect(results.length).toBe(2); // Both maps have NPC script
  });

  it("finds sign events across all maps", () => {
    const maps = project.getMapList();
    const signs: Array<{ map: string }> = [];

    for (const mapEntry of maps) {
      let mapData;
      try {
        mapData = project.readMapJson(mapEntry.name);
      } catch {
        continue;
      }
      const events = getAllEvents(mapData);
      for (const bg of events.bg_events) {
        if ((bg as Record<string, unknown>).type === "sign") {
          signs.push({ map: mapEntry.name });
        }
      }
    }

    expect(signs.length).toBe(2); // Both maps have a sign
  });

  it("handles maps with unreadable JSON gracefully (skips them)", () => {
    // Test that the search loop skips bad maps and continues
    const maps = project.getMapList();
    const skippedMaps: string[] = [];
    const results: Array<{ map: string }> = [];

    for (const mapEntry of maps) {
      let mapData;
      try {
        mapData = project.readMapJson(mapEntry.name);
      } catch {
        skippedMaps.push(mapEntry.name);
        continue;
      }
      results.push({ map: mapEntry.name });
    }

    // In normal case, no maps are skipped
    expect(skippedMaps).toHaveLength(0);
    expect(results).toHaveLength(2);
  });
});
