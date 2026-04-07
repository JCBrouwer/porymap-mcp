/**
 * Integration tests for tileset/layout operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import { findLayout, readLayouts } from "../../src/data/layouts.js";
import { searchMetatileLabels, getLabelsForTileset } from "../../src/data/metatile-labels.js";
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

describe("list_layouts equivalent", () => {
  it("returns all layouts from layouts.json", () => {
    const layoutsData = project.readLayouts();
    const layouts = layoutsData.layouts.map((l) => ({
      id: l.id,
      name: l.name,
      width: l.width,
      height: l.height,
    }));
    expect(layouts).toHaveLength(2);
    expect(layouts.find((l) => l.id === "LAYOUT_PETALBURG_CITY")).toBeDefined();
    expect(layouts.find((l) => l.id === "LAYOUT_ROUTE101")).toBeDefined();
  });
});

describe("get_layout equivalent", () => {
  it("finds layout by id", () => {
    const layoutsData = project.readLayouts();
    const layout = findLayout(layoutsData, "LAYOUT_PETALBURG_CITY");
    expect(layout).toBeDefined();
    expect(layout!.width).toBe(4);
    expect(layout!.height).toBe(4);
    expect(layout!.primary_tileset).toBe("gTileset_General");
    expect(layout!.secondary_tileset).toBe("gTileset_Petalburg");
  });

  it("finds layout by map name", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    const layoutsData = project.readLayouts();
    const layout = findLayout(layoutsData, mapData.layout);
    expect(layout).toBeDefined();
    expect(layout!.id).toBe("LAYOUT_PETALBURG_CITY");
  });

  it("returns undefined for unknown layout", () => {
    const layoutsData = project.readLayouts();
    expect(findLayout(layoutsData, "LAYOUT_MISSING")).toBeUndefined();
  });
});

describe("get_metatile_labels equivalent", () => {
  it("returns all metatile labels", () => {
    const labels = project.getMetatileLabels();
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.find((l) => l.label === "METATILE_General_Grass")).toBeDefined();
  });

  it("searchMetatileLabels filters by pattern", () => {
    const labels = project.getMetatileLabels();
    const grassLabels = searchMetatileLabels(labels, "Grass");
    expect(grassLabels.length).toBeGreaterThan(0);
    expect(grassLabels.every((l) => l.label.toLowerCase().includes("grass"))).toBe(true);
  });

  it("getLabelsForTileset filters by tileset name", () => {
    const labels = project.getMetatileLabels();
    const generalLabels = getLabelsForTileset(labels, "General");
    expect(generalLabels.length).toBeGreaterThan(0);
    expect(generalLabels.every((l) => l.tileset === "General")).toBe(true);
  });
});

describe("list_tilesets equivalent", () => {
  it("returns all tilesets", () => {
    const tilesets = project.getTilesets();
    expect(tilesets.length).toBe(3);
  });

  it("filters primary tilesets", () => {
    const primary = project.getPrimaryTilesets();
    expect(primary).toContain("gTileset_General");
    expect(primary).not.toContain("gTileset_Petalburg");
  });

  it("filters secondary tilesets", () => {
    const secondary = project.getSecondaryTilesets();
    expect(secondary).toContain("gTileset_Petalburg");
    expect(secondary).toContain("gTileset_Route101");
    expect(secondary).not.toContain("gTileset_General");
  });
});
