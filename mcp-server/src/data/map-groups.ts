import type { MapGroups } from "../types.js";
import { readJsonFile, writeJsonFile, McpError } from "../utils.js";

export function readMapGroups(filepath: string): MapGroups {
  return readJsonFile<MapGroups>(filepath);
}

export function writeMapGroups(filepath: string, data: MapGroups): void {
  writeJsonFile(filepath, data);
}

export interface MapListEntry {
  name: string;
  group: string;
}

// Get a flat list of all maps with their group assignments
export function getMapList(data: MapGroups): MapListEntry[] {
  const maps: MapListEntry[] = [];
  for (const group of data.group_order) {
    const groupMaps = data[group];
    if (Array.isArray(groupMaps)) {
      for (const mapName of groupMaps) {
        maps.push({ name: mapName as string, group });
      }
    }
  }
  return maps;
}

// Get maps in a specific group
export function getMapsInGroup(data: MapGroups, group: string): string[] {
  const groupMaps = data[group];
  if (!Array.isArray(groupMaps)) {
    throw new McpError("GROUP_NOT_FOUND", `Group '${group}' not found`);
  }
  return groupMaps as string[];
}

// Add a map to a group
export function addMapToGroup(
  data: MapGroups,
  mapName: string,
  group: string,
): void {
  if (!data.group_order.includes(group)) {
    // Create the group
    data.group_order.push(group);
    (data as Record<string, unknown>)[group] = [];
  }
  const groupMaps = data[group] as string[];
  if (!groupMaps.includes(mapName)) {
    groupMaps.push(mapName);
  }
}

// Remove a map from its group
export function removeMapFromGroup(data: MapGroups, mapName: string): boolean {
  for (const group of data.group_order) {
    const groupMaps = data[group];
    if (Array.isArray(groupMaps)) {
      const idx = (groupMaps as string[]).indexOf(mapName);
      if (idx !== -1) {
        (groupMaps as string[]).splice(idx, 1);
        return true;
      }
    }
  }
  return false;
}
