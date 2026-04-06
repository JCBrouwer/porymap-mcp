import * as fs from "node:fs";
import { McpError } from "../utils.js";

export interface MetatileLabel {
  label: string;
  metatileId: number;
  tileset: string;
}

// Parse metatile labels from include/constants/metatile_labels.h
// Format: #define METATILE_<TilesetName>_<LabelName> <value>
export function parseMetatileLabels(filepath: string): MetatileLabel[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const labels: MetatileLabel[] = [];
  const prefix = "METATILE_";

  for (const line of content.split("\n")) {
    const match = line.match(
      /^\s*#define\s+(METATILE_(\w+?)_(\w+))\s+(0x[\da-fA-F]+|\d+)/,
    );
    if (match) {
      const [, label, tileset, , valueStr] = match;
      const metatileId = valueStr.startsWith("0x")
        ? parseInt(valueStr, 16)
        : parseInt(valueStr, 10);
      labels.push({ label, metatileId, tileset });
    }
  }

  return labels;
}

// Search metatile labels by pattern (case-insensitive substring match)
export function searchMetatileLabels(
  labels: MetatileLabel[],
  pattern: string,
): MetatileLabel[] {
  const upper = pattern.toUpperCase();
  return labels.filter((l) => l.label.toUpperCase().includes(upper));
}

// Get labels for a specific tileset
export function getLabelsForTileset(
  labels: MetatileLabel[],
  tilesetName: string,
): MetatileLabel[] {
  // Strip the gTileset_ prefix if present
  const name = tilesetName.replace(/^gTileset_/, "");
  return labels.filter(
    (l) => l.tileset.toLowerCase() === name.toLowerCase(),
  );
}
