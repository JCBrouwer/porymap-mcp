import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  parseCDefineNames,
  parseEnumNames,
  parseConstants,
} from "../../src/data/constants.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "constants-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("parseCDefineNames", () => {
  it("extracts matching #define names", () => {
    const file = path.join(tmpDir, "species.h");
    fs.writeFileSync(
      file,
      `
#define SPECIES_NONE       0
#define SPECIES_BULBASAUR  1
#define SOMETHING_ELSE     2
#define SPECIES_IVYSAUR    3
`,
    );
    const result = parseCDefineNames(file, /\bSPECIES_\w+/);
    expect(result).toContain("SPECIES_NONE");
    expect(result).toContain("SPECIES_BULBASAUR");
    expect(result).toContain("SPECIES_IVYSAUR");
    expect(result).not.toContain("SOMETHING_ELSE");
  });

  it("returns empty array for missing file", () => {
    const result = parseCDefineNames(path.join(tmpDir, "nonexistent.h"), /\bSPECIES_/);
    expect(result).toEqual([]);
  });

  it("ignores commented-out defines", () => {
    const file = path.join(tmpDir, "test.h");
    fs.writeFileSync(file, `// #define SPECIES_FAKE 0\n#define SPECIES_REAL 1\n`);
    const result = parseCDefineNames(file, /\bSPECIES_\w+/);
    expect(result).not.toContain("SPECIES_FAKE");
    expect(result).toContain("SPECIES_REAL");
  });
});

describe("parseEnumNames", () => {
  it("extracts enum members", () => {
    const file = path.join(tmpDir, "weather.h");
    fs.writeFileSync(
      file,
      `
enum Weather {
    WEATHER_NONE = 0,
    WEATHER_SUNNY,
    WEATHER_RAIN,
};
`,
    );
    const result = parseEnumNames(file, /\bWEATHER_\w+/);
    expect(result).toContain("WEATHER_NONE");
    expect(result).toContain("WEATHER_SUNNY");
    expect(result).toContain("WEATHER_RAIN");
  });

  it("returns empty array for missing file", () => {
    const result = parseEnumNames(path.join(tmpDir, "no.h"), /\bWEATHER_/);
    expect(result).toEqual([]);
  });
});

describe("parseConstants", () => {
  it("parses species #defines", () => {
    const file = path.join(tmpDir, "species.h");
    fs.writeFileSync(file, "#define SPECIES_PIKACHU 25\n#define SPECIES_RAICHU 26\n");
    const result = parseConstants(file, "species");
    expect(result).toContain("SPECIES_PIKACHU");
    expect(result).toContain("SPECIES_RAICHU");
  });

  it("falls back to enum parsing when no #defines found", () => {
    const file = path.join(tmpDir, "weather.h");
    fs.writeFileSync(file, "enum Weather {\n    WEATHER_NONE = 0,\n    WEATHER_RAIN,\n};\n");
    const result = parseConstants(file, "weather");
    expect(result).toContain("WEATHER_NONE");
    expect(result).toContain("WEATHER_RAIN");
  });

  it("returns empty array for unrecognized type file", () => {
    const file = path.join(tmpDir, "empty.h");
    fs.writeFileSync(file, "");
    const result = parseConstants(file, "species");
    expect(result).toEqual([]);
  });
});
