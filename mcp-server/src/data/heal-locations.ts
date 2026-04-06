import type { HealLocationsJson, HealLocationData } from "../types.js";
import { readJsonFile, writeJsonFile, McpError } from "../utils.js";

export function readHealLocations(filepath: string): HealLocationsJson {
  return readJsonFile<HealLocationsJson>(filepath);
}

export function writeHealLocations(
  filepath: string,
  data: HealLocationsJson,
): void {
  writeJsonFile(filepath, data);
}

export function getHealLocationsForMap(
  data: HealLocationsJson,
  mapConstant: string,
): HealLocationData[] {
  return data.heal_locations.filter((hl) => hl.map === mapConstant);
}

export function setHealLocation(
  data: HealLocationsJson,
  location: HealLocationData,
): void {
  const idx = data.heal_locations.findIndex((hl) => hl.id === location.id);
  if (idx >= 0) {
    // Preserve custom fields from existing entry
    data.heal_locations[idx] = { ...data.heal_locations[idx], ...location };
  } else {
    data.heal_locations.push(location);
  }
}

export function removeHealLocation(
  data: HealLocationsJson,
  id: string,
): boolean {
  const idx = data.heal_locations.findIndex((hl) => hl.id === id);
  if (idx < 0) return false;
  data.heal_locations.splice(idx, 1);
  return true;
}
