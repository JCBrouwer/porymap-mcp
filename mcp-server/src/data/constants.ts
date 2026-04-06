import * as fs from "node:fs";
import type { ConstantType } from "../types.js";

// Regex patterns matching porymap's identifier config defaults
const CONSTANT_PATTERNS: Record<ConstantType, RegExp> = {
  species: /\bSPECIES_\w+/,
  items: /\bITEM_(?!(B_)?USE_)\w+/,
  flags: /\bFLAG_\w+/,
  vars: /\bVAR_\w+/,
  weather: /\bWEATHER_\w+/,
  songs: /\b(SE|MUS)_\w+/,
  movement_types: /\bMOVEMENT_TYPE_\w+/,
  map_types: /\bMAP_TYPE_\w+/,
  battle_scenes: /\bMAP_BATTLE_SCENE_\w+/,
  trainer_types: /\bTRAINER_TYPE_\w+/,
  obj_event_gfx: /\bOBJ_EVENT_GFX_\w+/,
  metatile_behaviors: /\bMB_\w+/,
  sign_facing_directions: /\bBG_EVENT_PLAYER_FACING_\w+/,
  secret_bases: /\bSECRET_BASE_[\w]+_[\d]+/,
};

// Parse #define names from a C header file that match a regex
export function parseCDefineNames(
  filepath: string,
  filter: RegExp,
): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const defines: string[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*#define\s+(\w+)/);
    if (match && filter.test(match[1])) {
      defines.push(match[1]);
    }
  }
  return defines;
}

// Parse enum member names from a C header file that match a regex
export function parseEnumNames(
  filepath: string,
  filter: RegExp,
): string[] {
  let content: string;
  try {
    content = fs.readFileSync(filepath, "utf-8");
  } catch {
    return [];
  }

  const names: string[] = [];
  // Match enum members: lines like "    MEMBER_NAME," or "    MEMBER_NAME = value,"
  for (const line of content.split("\n")) {
    const match = line.match(/^\s+(\w+)\s*[,=}/]/);
    if (match && filter.test(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

// Parse all constants of a given type from the appropriate header file
export function parseConstants(
  filepath: string,
  type: ConstantType,
): string[] {
  const pattern = CONSTANT_PATTERNS[type];
  if (!pattern) return [];

  const defines = parseCDefineNames(filepath, pattern);
  if (defines.length > 0) return defines;

  // Fall back to enum parsing if no #defines found
  return parseEnumNames(filepath, pattern);
}

export function getConstantPattern(type: ConstantType): RegExp {
  return CONSTANT_PATTERNS[type];
}
