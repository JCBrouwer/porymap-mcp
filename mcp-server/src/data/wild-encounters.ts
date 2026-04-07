import type {
  WildEncountersJson,
  WildEncounterGroup,
  WildEncounterEntry,
  WildEncounterFieldDef,
  WildEncounterMon,
} from "../types.js";
import { readJsonFile, writeJsonFile, McpError } from "../utils.js";

export function readWildEncounters(filepath: string): WildEncountersJson {
  return readJsonFile<WildEncountersJson>(filepath);
}

export function writeWildEncounters(
  filepath: string,
  data: WildEncountersJson,
): void {
  writeJsonFile(filepath, data);
}

// Get the main encounter group (for_maps: true)
export function getMainEncounterGroup(
  data: WildEncountersJson,
): WildEncounterGroup | undefined {
  return data.wild_encounter_groups.find((g) => g.for_maps);
}

// Get encounter field definitions (slot counts, rates)
export function getEncounterFieldDefs(
  data: WildEncountersJson,
): WildEncounterFieldDef[] {
  const group = getMainEncounterGroup(data);
  return group?.fields ?? [];
}

// Get encounters for a specific map constant
export function getEncountersForMap(
  data: WildEncountersJson,
  mapConstant: string,
): WildEncounterEntry | undefined {
  const group = getMainEncounterGroup(data);
  if (!group) return undefined;
  return group.encounters.find((e) => e.map === mapConstant);
}

// Get encounter data for a specific field type on a map
export function getFieldEncounters(
  entry: WildEncounterEntry,
  fieldType: string,
): { encounter_rate: number; mons: WildEncounterMon[] } | undefined {
  const fieldData = entry[fieldType];
  if (
    fieldData &&
    typeof fieldData === "object" &&
    "encounter_rate" in (fieldData as Record<string, unknown>)
  ) {
    return fieldData as { encounter_rate: number; mons: WildEncounterMon[] };
  }
  return undefined;
}

// Set encounter data for a specific field type on a map
export function setFieldEncounters(
  data: WildEncountersJson,
  mapConstant: string,
  baseLabel: string,
  fieldType: string,
  encounterRate: number,
  mons: WildEncounterMon[],
): void {
  const group = getMainEncounterGroup(data);
  if (!group) {
    throw new McpError(
      "NO_ENCOUNTER_GROUP",
      "No encounter group with for_maps: true found",
    );
  }

  // Validate slot count against field definition
  const fieldDef = group.fields.find((f) => f.type === fieldType);
  if (fieldDef && mons.length !== fieldDef.encounter_rates.length) {
    throw new McpError(
      "INVALID_SLOT_COUNT",
      `Field '${fieldType}' expects ${fieldDef.encounter_rates.length} slots, got ${mons.length}`,
    );
  }

  let entry = group.encounters.find((e) => e.map === mapConstant);
  if (!entry) {
    entry = { map: mapConstant, base_label: baseLabel };
    group.encounters.push(entry);
  }

  entry[fieldType] = { encounter_rate: encounterRate, mons };
}

// Remove encounter data for a specific field type on a map
export function removeFieldEncounters(
  data: WildEncountersJson,
  mapConstant: string,
  fieldType: string,
): boolean {
  const group = getMainEncounterGroup(data);
  if (!group) return false;

  const entry = group.encounters.find((e) => e.map === mapConstant);
  if (!entry || !(fieldType in entry)) return false;

  delete entry[fieldType];

  // Remove the entry entirely if no field types remain
  const remainingFields = Object.keys(entry).filter(
    (k) => k !== "map" && k !== "base_label",
  );
  if (remainingFields.length === 0) {
    const idx = group.encounters.indexOf(entry);
    group.encounters.splice(idx, 1);
  }

  return true;
}

// Find all maps that have a specific species in their encounters
export function findMapsWithSpecies(
  data: WildEncountersJson,
  species: string,
): Array<{
  map: string;
  fieldType: string;
  slots: number[];
  minLevel: number;
  maxLevel: number;
}> {
  const results: Array<{
    map: string;
    fieldType: string;
    slots: number[];
    minLevel: number;
    maxLevel: number;
  }> = [];

  const group = getMainEncounterGroup(data);
  if (!group) return results;

  for (const entry of group.encounters) {
    for (const fieldDef of group.fields) {
      const fieldData = getFieldEncounters(entry, fieldDef.type);
      if (!fieldData) continue;

      const slots: number[] = [];
      let minLevel = Infinity;
      let maxLevel = -Infinity;

      for (let i = 0; i < fieldData.mons.length; i++) {
        if (fieldData.mons[i].species === species) {
          slots.push(i);
          minLevel = Math.min(minLevel, fieldData.mons[i].min_level);
          maxLevel = Math.max(maxLevel, fieldData.mons[i].max_level);
        }
      }

      if (slots.length > 0) {
        results.push({
          map: entry.map,
          fieldType: fieldDef.type,
          slots,
          minLevel,
          maxLevel,
        });
      }
    }
  }

  return results;
}
