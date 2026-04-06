import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  readMapBlocks,
  readMapBlockRegion,
  readBorderBlocks,
  setMapBlocks,
  fillMapBlocks,
  resizeLayout,
  shiftMapBlocks,
  setBorderBlocks,
  createBlockdata,
  findLayout,
  getLayoutForMap,
} from "../../src/data/layouts.js";
import { writeBlockdata } from "../../src/utils.js";
import type { Layout, LayoutsJson } from "../../src/types.js";

let tmpDir: string;

function makeLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    id: "LAYOUT_TEST",
    name: "TestMap",
    width: 4,
    height: 4,
    border_width: 2,
    border_height: 2,
    primary_tileset: "gTileset_General",
    secondary_tileset: "gTileset_Test",
    blockdata_filepath: "map.bin",
    border_filepath: "border.bin",
    ...overrides,
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "layouts-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTestBlockdata(file: string, width: number, height: number, defaultMetatile = 1) {
  const blocks = [];
  for (let i = 0; i < width * height; i++) {
    blocks.push({ metatileId: defaultMetatile, collision: 0, elevation: 3 });
  }
  writeBlockdata(path.join(tmpDir, file), blocks);
}

describe("readMapBlocks", () => {
  it("reads all blocks from a 4x4 map", () => {
    writeTestBlockdata("map.bin", 4, 4, 7);
    const layout = makeLayout();
    const blocks = readMapBlocks(tmpDir, layout);
    expect(blocks.length).toBe(16);
    expect(blocks[0]).toEqual({ x: 0, y: 0, metatileId: 7, collision: 0, elevation: 3 });
    expect(blocks[5]).toEqual({ x: 1, y: 1, metatileId: 7, collision: 0, elevation: 3 });
  });
});

describe("readMapBlockRegion", () => {
  it("reads a sub-region", () => {
    writeTestBlockdata("map.bin", 4, 4, 3);
    const layout = makeLayout();
    const region = readMapBlockRegion(tmpDir, layout, 1, 1, 2, 2);
    expect(region.length).toBe(4);
    expect(region.every((b) => b.metatileId === 3)).toBe(true);
    expect(region[0]).toMatchObject({ x: 1, y: 1 });
    expect(region[1]).toMatchObject({ x: 2, y: 1 });
    expect(region[2]).toMatchObject({ x: 1, y: 2 });
    expect(region[3]).toMatchObject({ x: 2, y: 2 });
  });

  it("clips to map bounds", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    const region = readMapBlockRegion(tmpDir, layout, 3, 3, 5, 5); // exceeds bounds
    expect(region.length).toBe(1); // only (3,3) is valid
  });
});

describe("readBorderBlocks", () => {
  it("reads 2x2 border", () => {
    writeTestBlockdata("border.bin", 2, 2, 5);
    const layout = makeLayout();
    const blocks = readBorderBlocks(tmpDir, layout);
    expect(blocks.length).toBe(4);
    expect(blocks[0]).toMatchObject({ x: 0, y: 0, metatileId: 5 });
  });
});

describe("setMapBlocks", () => {
  it("updates specific blocks", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    const count = setMapBlocks(tmpDir, layout, [
      { x: 0, y: 0, metatileId: 42, collision: 1, elevation: 5 },
      { x: 3, y: 3, metatileId: 99, collision: 0, elevation: 3 },
    ]);
    expect(count).toBe(2);
    const blocks = readMapBlocks(tmpDir, layout);
    expect(blocks[0]).toMatchObject({ x: 0, y: 0, metatileId: 42, collision: 1, elevation: 5 });
    expect(blocks[15]).toMatchObject({ x: 3, y: 3, metatileId: 99 });
    // Other blocks unchanged
    expect(blocks[1]).toMatchObject({ metatileId: 1 });
  });

  it("throws for out-of-bounds coordinates", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    expect(() =>
      setMapBlocks(tmpDir, layout, [{ x: 4, y: 0, metatileId: 1, collision: 0, elevation: 3 }]),
    ).toThrow();
  });
});

describe("fillMapBlocks", () => {
  it("fills a rectangular region", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    const count = fillMapBlocks(tmpDir, layout, 1, 1, 2, 2, 55, 0, 3);
    expect(count).toBe(4);
    const blocks = readMapBlocks(tmpDir, layout);
    // (1,1), (2,1), (1,2), (2,2) should be 55
    expect(blocks[5]).toMatchObject({ metatileId: 55 });
    expect(blocks[6]).toMatchObject({ metatileId: 55 });
    expect(blocks[9]).toMatchObject({ metatileId: 55 });
    expect(blocks[10]).toMatchObject({ metatileId: 55 });
    // (0,0) should still be 1
    expect(blocks[0]).toMatchObject({ metatileId: 1 });
  });

  it("clips fill region to map bounds", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    const count = fillMapBlocks(tmpDir, layout, 3, 3, 10, 10, 7, 0, 3);
    expect(count).toBe(1); // only (3,3) is in bounds
  });
});

describe("resizeLayout", () => {
  it("shrinks map and preserves existing blocks", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    resizeLayout(tmpDir, layout, 2, 2);
    const blocks = readMapBlocks(tmpDir, { ...layout, width: 2, height: 2 });
    expect(blocks.length).toBe(4);
    expect(blocks[0]).toMatchObject({ metatileId: 1 });
  });

  it("expands map and fills new space with default metatile", () => {
    writeTestBlockdata("map.bin", 2, 2, 5);
    const layout = makeLayout({ width: 2, height: 2 });
    resizeLayout(tmpDir, layout, 4, 4, 99);
    const blocks = readMapBlocks(tmpDir, { ...layout, width: 4, height: 4 });
    expect(blocks.length).toBe(16);
    // Original 2x2 blocks (at (0,0),(1,0),(0,1),(1,1)) should still be 5
    expect(blocks[0]).toMatchObject({ metatileId: 5 }); // (0,0)
    expect(blocks[1]).toMatchObject({ metatileId: 5 }); // (1,0)
    // First new block is at (2,0) = index 2
    expect(blocks[2]).toMatchObject({ metatileId: 99 }); // (2,0)
    expect(blocks[3]).toMatchObject({ metatileId: 99 }); // (3,0)
  });
});

describe("shiftMapBlocks", () => {
  it("shifts blocks right and fills left edge", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    // Set (0,0) to a distinctive value
    setMapBlocks(tmpDir, layout, [{ x: 0, y: 0, metatileId: 7, collision: 0, elevation: 3 }]);
    shiftMapBlocks(tmpDir, layout, 1, 0, 0); // shift right by 1
    const blocks = readMapBlocks(tmpDir, layout);
    // (0,0) should now be fill (0), (1,0) should be 7 (shifted from (0,0))
    expect(blocks[0]).toMatchObject({ metatileId: 0 });
    expect(blocks[1]).toMatchObject({ metatileId: 7 });
  });

  it("shifts blocks down and fills top edge", () => {
    writeTestBlockdata("map.bin", 4, 4, 1);
    const layout = makeLayout();
    setMapBlocks(tmpDir, layout, [{ x: 0, y: 0, metatileId: 9, collision: 0, elevation: 3 }]);
    shiftMapBlocks(tmpDir, layout, 0, 1, 0); // shift down by 1
    const blocks = readMapBlocks(tmpDir, layout);
    expect(blocks[0]).toMatchObject({ metatileId: 0 }); // (0,0) is now fill
    expect(blocks[4]).toMatchObject({ metatileId: 9 }); // (0,1) is the shifted value
  });
});

describe("setBorderBlocks", () => {
  it("updates border blocks at specific positions", () => {
    writeTestBlockdata("border.bin", 2, 2, 1);
    const layout = makeLayout();
    setBorderBlocks(tmpDir, layout, [
      { x: 0, y: 0, metatileId: 77, collision: 0, elevation: 0 },
    ]);
    const blocks = readBorderBlocks(tmpDir, layout);
    expect(blocks[0]).toMatchObject({ metatileId: 77 });
    expect(blocks[1]).toMatchObject({ metatileId: 1 }); // unchanged
  });
});

describe("createBlockdata", () => {
  it("creates blockdata and border files", () => {
    const layout: Layout = {
      id: "LAYOUT_NEW",
      name: "NewMap",
      width: 3,
      height: 3,
      border_width: 2,
      border_height: 2,
      primary_tileset: "gTileset_General",
      secondary_tileset: "gTileset_Test",
      blockdata_filepath: "new/map.bin",
      border_filepath: "new/border.bin",
    };
    fs.mkdirSync(path.join(tmpDir, "new"), { recursive: true });
    createBlockdata(tmpDir, layout, 5, 8);
    const blocks = readMapBlocks(tmpDir, layout);
    expect(blocks.length).toBe(9);
    expect(blocks[0]).toMatchObject({ metatileId: 5, collision: 0, elevation: 3 });
    const border = readBorderBlocks(tmpDir, layout);
    expect(border.length).toBe(4);
    expect(border[0]).toMatchObject({ metatileId: 8 });
  });
});

describe("findLayout / getLayoutForMap", () => {
  const layoutsData: LayoutsJson = {
    layouts_table_label: "gMapLayouts",
    layouts: [
      {
        id: "LAYOUT_FOO",
        name: "Foo",
        width: 2,
        height: 2,
        primary_tileset: "a",
        secondary_tileset: "b",
        blockdata_filepath: "foo/map.bin",
        border_filepath: "foo/border.bin",
      },
    ],
  };

  it("finds layout by id", () => {
    expect(findLayout(layoutsData, "LAYOUT_FOO")).toBeDefined();
  });

  it("finds layout by name", () => {
    expect(findLayout(layoutsData, "Foo")).toBeDefined();
  });

  it("returns undefined for unknown layout", () => {
    expect(findLayout(layoutsData, "LAYOUT_MISSING")).toBeUndefined();
  });

  it("getLayoutForMap throws for unknown layout", () => {
    expect(() => getLayoutForMap(layoutsData, "LAYOUT_MISSING")).toThrow();
  });
});
