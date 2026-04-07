import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  decodeBlock,
  encodeBlock,
  readBlockdata,
  writeBlockdata,
  mapNameToConstant,
  layoutNameToConstant,
} from "../src/utils.js";

describe("decodeBlock / encodeBlock", () => {
  it("round-trips simple values", () => {
    const cases = [
      { metatileId: 0, collision: 0, elevation: 0 },
      { metatileId: 1, collision: 0, elevation: 3 },
      { metatileId: 0x3ff, collision: 3, elevation: 15 },
      { metatileId: 42, collision: 2, elevation: 7 },
    ];
    for (const c of cases) {
      const encoded = encodeBlock(c.metatileId, c.collision, c.elevation);
      const decoded = decodeBlock(encoded);
      expect(decoded).toEqual(c);
    }
  });

  it("masks overflow values", () => {
    const encoded = encodeBlock(0x1fff, 0xff, 0xff); // values exceed bit width
    const decoded = decodeBlock(encoded);
    expect(decoded.metatileId).toBe(0x3ff);
    expect(decoded.collision).toBe(3);
    expect(decoded.elevation).toBe(15);
  });
});

describe("readBlockdata / writeBlockdata", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blocks-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips block arrays", () => {
    const filepath = path.join(tmpDir, "test.bin");
    const blocks = [
      { metatileId: 1, collision: 0, elevation: 3 },
      { metatileId: 100, collision: 1, elevation: 5 },
      { metatileId: 0x3ff, collision: 3, elevation: 15 },
    ];
    writeBlockdata(filepath, blocks);
    const read = readBlockdata(filepath);
    expect(read).toEqual(blocks);
  });

  it("writes atomically via temp file", () => {
    const filepath = path.join(tmpDir, "atomic.bin");
    const blocks = [{ metatileId: 5, collision: 0, elevation: 3 }];
    writeBlockdata(filepath, blocks);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(fs.existsSync(filepath + ".tmp")).toBe(false);
  });
});

describe("mapNameToConstant", () => {
  it("converts camelCase names", () => {
    expect(mapNameToConstant("PetalburgCity")).toBe("MAP_PETALBURG_CITY");
    expect(mapNameToConstant("LittlerootTown")).toBe("MAP_LITTLEROOT_TOWN");
    expect(mapNameToConstant("Route101")).toBe("MAP_ROUTE101");
    expect(mapNameToConstant("Route104NorthSection")).toBe("MAP_ROUTE104_NORTH_SECTION");
  });
});

describe("layoutNameToConstant", () => {
  it("converts camelCase names", () => {
    expect(layoutNameToConstant("PetalburgCity")).toBe("LAYOUT_PETALBURG_CITY");
    expect(layoutNameToConstant("Route101")).toBe("LAYOUT_ROUTE101");
  });
});
