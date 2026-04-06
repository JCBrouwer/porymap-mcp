import type {
  MapJson,
  ConnectionData,
  ObjectEventData,
  WarpEventData,
  CoordEventData,
  BgEventData,
} from "../types.js";
import { readJsonFile, writeJsonFile, McpError } from "../utils.js";

export function readMapJson(filepath: string): MapJson {
  return readJsonFile<MapJson>(filepath);
}

export function writeMapJson(filepath: string, data: MapJson): void {
  writeJsonFile(filepath, data);
}

// --- Header operations ---

export function getMapHeader(data: MapJson): Record<string, unknown> {
  const {
    object_events: _oe,
    warp_events: _we,
    coord_events: _ce,
    bg_events: _be,
    connections: _conn,
    ...header
  } = data;
  return header;
}

export function updateMapHeader(
  data: MapJson,
  updates: Record<string, unknown>,
): void {
  const headerFields = [
    "music",
    "region_map_section",
    "requires_flash",
    "weather",
    "map_type",
    "show_map_name",
    "battle_scene",
    "allow_cycling",
    "allow_escaping",
    "allow_running",
    "floor_number",
  ];
  for (const [key, value] of Object.entries(updates)) {
    if (headerFields.includes(key) && value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }
}

// --- Connection operations ---

export function getConnections(data: MapJson): ConnectionData[] {
  return data.connections ?? [];
}

export function addConnection(
  data: MapJson,
  connection: ConnectionData,
): void {
  if (!data.connections) {
    data.connections = [];
  }
  data.connections.push(connection);
}

export function updateConnection(
  data: MapJson,
  index: number,
  updates: Partial<ConnectionData>,
): void {
  const connections = data.connections ?? [];
  if (index < 0 || index >= connections.length) {
    throw new McpError(
      "INVALID_CONNECTION_INDEX",
      `Connection index ${index} out of range (0-${connections.length - 1})`,
    );
  }
  Object.assign(connections[index], updates);
}

export function removeConnection(data: MapJson, index: number): void {
  const connections = data.connections ?? [];
  if (index < 0 || index >= connections.length) {
    throw new McpError(
      "INVALID_CONNECTION_INDEX",
      `Connection index ${index} out of range (0-${connections.length - 1})`,
    );
  }
  connections.splice(index, 1);
}

// Compute the reverse direction for mirror connections
export function reverseDirection(
  direction: string,
): string | null {
  const reverseMap: Record<string, string> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
    dive: "emerge",
    emerge: "dive",
  };
  return reverseMap[direction] ?? null;
}

// --- Event operations ---

type EventGroup = "object" | "warp" | "coord" | "bg";

function getEventArray(data: MapJson, group: EventGroup): unknown[] {
  switch (group) {
    case "object":
      return data.object_events;
    case "warp":
      return data.warp_events;
    case "coord":
      return data.coord_events;
    case "bg":
      return data.bg_events;
  }
}

// Map event_type to the group it belongs to
export function eventTypeToGroup(
  eventType: string,
): EventGroup {
  switch (eventType) {
    case "object":
    case "clone_object":
      return "object";
    case "warp":
      return "warp";
    case "trigger":
    case "weather_trigger":
      return "coord";
    case "sign":
    case "hidden_item":
    case "secret_base":
      return "bg";
    default:
      throw new McpError("INVALID_EVENT_TYPE", `Unknown event type: ${eventType}`);
  }
}

export function getAllEvents(data: MapJson) {
  return {
    object_events: data.object_events ?? [],
    warp_events: data.warp_events ?? [],
    coord_events: data.coord_events ?? [],
    bg_events: data.bg_events ?? [],
  };
}

export function getEventsByType(data: MapJson, eventType: string) {
  const group = eventTypeToGroup(eventType);
  const events = getEventArray(data, group);

  // For coord and bg events, filter by the specific type
  if (group === "coord" || group === "bg") {
    return events.filter(
      (e) => (e as Record<string, unknown>).type === eventType,
    );
  }

  // For object events, filter by type field if looking for clone_object
  if (eventType === "clone_object") {
    return events.filter(
      (e) => (e as Record<string, unknown>).type === "clone_object",
    );
  }
  if (eventType === "object") {
    return events.filter(
      (e) => (e as Record<string, unknown>).type !== "clone_object",
    );
  }

  return events;
}

export function addObjectEvent(
  data: MapJson,
  event: ObjectEventData,
): number {
  if (!data.object_events) data.object_events = [];
  data.object_events.push(event);
  return data.object_events.length - 1;
}

export function addWarpEvent(
  data: MapJson,
  event: WarpEventData,
): number {
  if (!data.warp_events) data.warp_events = [];
  data.warp_events.push(event);
  return data.warp_events.length - 1;
}

export function addCoordEvent(
  data: MapJson,
  event: CoordEventData,
): number {
  if (!data.coord_events) data.coord_events = [];
  data.coord_events.push(event);
  return data.coord_events.length - 1;
}

export function addBgEvent(
  data: MapJson,
  event: BgEventData,
): number {
  if (!data.bg_events) data.bg_events = [];
  data.bg_events.push(event);
  return data.bg_events.length - 1;
}

export function updateEvent(
  data: MapJson,
  group: EventGroup,
  index: number,
  updates: Record<string, unknown>,
): void {
  const events = getEventArray(data, group);
  if (index < 0 || index >= events.length) {
    throw new McpError(
      "INVALID_EVENT_INDEX",
      `Event index ${index} out of range for ${group} events (0-${events.length - 1})`,
    );
  }
  Object.assign(events[index] as Record<string, unknown>, updates);
}

export function removeEvent(
  data: MapJson,
  group: EventGroup,
  index: number,
): void {
  const events = getEventArray(data, group);
  if (index < 0 || index >= events.length) {
    throw new McpError(
      "INVALID_EVENT_INDEX",
      `Event index ${index} out of range for ${group} events (0-${events.length - 1})`,
    );
  }
  events.splice(index, 1);
}

// Create a default empty map.json
export function createDefaultMapJson(
  mapName: string,
  mapId: string,
  layoutId: string,
  options: {
    music?: string;
    location?: string;
    weather?: string;
    mapType?: string;
    battleScene?: string;
    requiresFlash?: boolean;
    showMapName?: boolean;
    allowRunning?: boolean;
    allowBiking?: boolean;
    allowEscaping?: boolean;
    floorNumber?: number;
  } = {},
): MapJson {
  return {
    id: mapId,
    name: mapName,
    layout: layoutId,
    music: options.music ?? "MUS_DUMMY",
    region_map_section: options.location ?? "MAPSEC_NONE",
    requires_flash: options.requiresFlash ?? false,
    weather: options.weather ?? "WEATHER_NONE",
    map_type: options.mapType ?? "MAP_TYPE_NONE",
    show_map_name: options.showMapName ?? true,
    battle_scene: options.battleScene ?? "MAP_BATTLE_SCENE_NORMAL",
    connections: [],
    object_events: [],
    warp_events: [],
    coord_events: [],
    bg_events: [],
  };
}
