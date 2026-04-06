import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  readMapGroups,
  getMapList,
  addMapToGroup,
  writeMapGroups,
} from "../../src/data/map-groups.js";
import type { MapGroups } from "../../src/types.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "map-groups-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeGroups(): MapGroups {
  return {
    group_order: ["gMapGroup_Towns", "gMapGroup_Routes"],
    gMapGroup_Towns: ["PetalburgCity", "OldaleTown"],
    gMapGroup_Routes: ["Route101", "Route102"],
  };
}

describe("readMapGroups", () => {
  it("reads and parses map_groups.json", () => {
    const file = path.join(tmpDir, "map_groups.json");
    fs.writeFileSync(file, JSON.stringify(makeGroups(), null, 4));
    const groups = readMapGroups(file);
    expect(groups.group_order).toEqual(["gMapGroup_Towns", "gMapGroup_Routes"]);
    expect(groups.gMapGroup_Towns).toEqual(["PetalburgCity", "OldaleTown"]);
  });
});

describe("getMapList", () => {
  it("returns flat list of maps with group metadata", () => {
    const groups = makeGroups();
    const list = getMapList(groups);
    expect(list.length).toBe(4);
    const petalburg = list.find((m) => m.name === "PetalburgCity");
    expect(petalburg).toBeDefined();
    expect(petalburg!.group).toBe("gMapGroup_Towns");
    const route = list.find((m) => m.name === "Route101");
    expect(route!.group).toBe("gMapGroup_Routes");
  });
});

describe("addMapToGroup", () => {
  it("adds a map to an existing group", () => {
    const groups = makeGroups();
    addMapToGroup(groups, "LittlerootTown", "gMapGroup_Towns");
    expect(groups.gMapGroup_Towns as string[]).toContain("LittlerootTown");
  });

  it("creates a new group if it doesn't exist", () => {
    const groups = makeGroups();
    addMapToGroup(groups, "DungeonB1F", "gMapGroup_Dungeons");
    expect(groups.group_order).toContain("gMapGroup_Dungeons");
    expect(groups.gMapGroup_Dungeons as string[]).toContain("DungeonB1F");
  });
});

describe("writeMapGroups", () => {
  it("writes and reads back correctly", () => {
    const file = path.join(tmpDir, "map_groups.json");
    const groups = makeGroups();
    writeMapGroups(file, groups);
    const read = readMapGroups(file);
    expect(read.group_order).toEqual(groups.group_order);
    expect(read.gMapGroup_Towns).toEqual(groups.gMapGroup_Towns);
  });
});
