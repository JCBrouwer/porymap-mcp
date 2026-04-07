import * as fs from "node:fs";

export interface TilesetInfo {
  name: string;
  isSecondary: boolean;
}

// Parse tileset definitions from C header file
// Looking for patterns like:
//   const struct Tileset gTileset_General = {
//       .isSecondary = FALSE,
// or: const struct TilesetPrimary gTileset_General = {
export function parseTilesetHeaders(filepath: string): TilesetInfo[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const tilesets: TilesetInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    // Match tileset struct declaration
    const structMatch = lines[i].match(
      /const\s+struct\s+(?:Tileset(?:Primary|Secondary)?)\s+(gTileset_\w+)/,
    );
    if (structMatch) {
      const name = structMatch[1];
      let isSecondary = false;

      // Check if struct type indicates secondary
      if (lines[i].includes("TilesetSecondary")) {
        isSecondary = true;
      } else if (lines[i].includes("TilesetPrimary")) {
        isSecondary = false;
      } else {
        // Look for .isSecondary field in the next few lines
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const secMatch = lines[j].match(/\.isSecondary\s*=\s*(\w+)/);
          if (secMatch) {
            isSecondary = secMatch[1] === "TRUE";
            break;
          }
          if (lines[j].includes("};")) break;
        }
      }

      tilesets.push({ name, isSecondary });
    }
  }

  return tilesets;
}

// Also try ASM format: data/tilesets/headers.inc
export function parseTilesetHeadersAsm(filepath: string): TilesetInfo[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const tilesets: TilesetInfo[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const labelMatch = lines[i].match(/^(gTileset_\w+)::/);
    if (labelMatch) {
      const name = labelMatch[1];
      let isSecondary = false;

      // Look for .byte TRUE/FALSE for isSecondary in next few lines
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const byteMatch = lines[j].match(/\.byte\s+(TRUE|FALSE)/);
        if (byteMatch) {
          isSecondary = byteMatch[1] === "TRUE";
          break;
        }
      }

      tilesets.push({ name, isSecondary });
    }
  }

  return tilesets;
}
