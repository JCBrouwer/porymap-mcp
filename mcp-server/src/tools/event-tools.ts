import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  writeMapJson,
  addObjectEvent,
  addWarpEvent,
  addCoordEvent,
  addBgEvent,
  updateEvent,
  removeEvent,
  eventTypeToGroup,
} from "../data/map-json.js";
import type {
  ObjectEventData,
  WarpEventData,
  CoordEventData,
  BgEventData,
} from "../types.js";

export function registerEventTools(server: McpServer): void {
  server.tool(
    "add_event",
    "Add a new event to a map. Fields vary by event_type: object (NPC), clone_object, warp, trigger, weather_trigger, sign, hidden_item, secret_base.",
    {
      map: z.string().describe("Map name"),
      event_type: z
        .enum(["object", "clone_object", "warp", "trigger", "weather_trigger", "sign", "hidden_item", "secret_base"])
        .describe("Type of event to add"),
      x: z.number().int().describe("X coordinate"),
      y: z.number().int().describe("Y coordinate"),
      elevation: z.number().int().min(0).max(15).optional().describe("Elevation (default: 0)"),
      // Object event fields
      graphics_id: z.string().optional().describe("Object: sprite graphics ID (e.g. 'OBJ_EVENT_GFX_WOMAN_1')"),
      movement_type: z.string().optional().describe("Object: movement type constant"),
      movement_range_x: z.number().int().optional().describe("Object: movement X radius (default: 0)"),
      movement_range_y: z.number().int().optional().describe("Object: movement Y radius (default: 0)"),
      script: z.string().optional().describe("Script label for object/trigger/sign events"),
      flag: z.string().optional().describe("Event flag for object/hidden_item events"),
      trainer_type: z.string().optional().describe("Object: trainer type constant"),
      sight_radius: z.string().optional().describe("Object: sight radius or berry tree ID"),
      local_id: z.string().optional().describe("Object: optional local ID name"),
      // Warp fields
      dest_map: z.string().optional().describe("Warp: destination map constant"),
      dest_warp_id: z.string().optional().describe("Warp: destination warp ID"),
      warp_id: z.string().optional().describe("Warp: optional warp ID name"),
      // Trigger fields
      var: z.string().optional().describe("Trigger: variable name"),
      var_value: z.string().optional().describe("Trigger: variable value"),
      // Weather trigger fields
      weather: z.string().optional().describe("Weather trigger: weather type constant"),
      // Sign fields
      player_facing_dir: z.string().optional().describe("Sign: required player facing direction"),
      // Hidden item fields
      item: z.string().optional().describe("Hidden item: item constant"),
      quantity: z.number().int().optional().describe("Hidden item: quantity (pokefirered)"),
      underfoot: z.boolean().optional().describe("Hidden item: requires Itemfinder (pokefirered)"),
      // Secret base fields
      secret_base_id: z.string().optional().describe("Secret base: base ID constant"),
      // Clone object fields
      target_local_id: z.string().optional().describe("Clone object: target object local ID"),
      target_map: z.string().optional().describe("Clone object: target map constant"),
    },
    async (params) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(params.map);
        let eventIndex: number;

        switch (params.event_type) {
          case "object": {
            const event: ObjectEventData = {
              graphics_id: params.graphics_id ?? "OBJ_EVENT_GFX_WOMAN_1",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              movement_type: params.movement_type ?? "MOVEMENT_TYPE_FACE_DOWN",
              movement_range_x: params.movement_range_x ?? 0,
              movement_range_y: params.movement_range_y ?? 0,
              trainer_type: params.trainer_type ?? "TRAINER_TYPE_NONE",
              trainer_sight_or_berry_tree_id: params.sight_radius ?? "0",
              script: params.script ?? "",
              flag: params.flag ?? "0",
            };
            if (params.local_id) event.local_id = params.local_id;
            eventIndex = addObjectEvent(mapData, event);
            break;
          }
          case "clone_object": {
            const event: ObjectEventData = {
              type: "clone_object",
              graphics_id: params.graphics_id ?? "OBJ_EVENT_GFX_WOMAN_1",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              movement_type: "MOVEMENT_TYPE_FACE_DOWN",
              movement_range_x: 0,
              movement_range_y: 0,
              trainer_type: "TRAINER_TYPE_NONE",
              trainer_sight_or_berry_tree_id: "0",
              script: "",
              flag: "0",
              target_local_id: params.target_local_id ?? "1",
              target_map: params.target_map ?? "MAP_NONE",
            };
            if (params.local_id) event.local_id = params.local_id;
            eventIndex = addObjectEvent(mapData, event);
            break;
          }
          case "warp": {
            const event: WarpEventData = {
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              dest_map: params.dest_map ?? "MAP_NONE",
              dest_warp_id: params.dest_warp_id ?? "0",
            };
            if (params.warp_id) event.warp_id = params.warp_id;
            eventIndex = addWarpEvent(mapData, event);
            break;
          }
          case "trigger": {
            const event: CoordEventData = {
              type: "trigger",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              var: params.var ?? "VAR_TEMP_0",
              var_value: params.var_value ?? "0",
              script: params.script ?? "",
            };
            eventIndex = addCoordEvent(mapData, event);
            break;
          }
          case "weather_trigger": {
            const event: CoordEventData = {
              type: "weather_trigger",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              weather: params.weather ?? "WEATHER_NONE",
            };
            eventIndex = addCoordEvent(mapData, event);
            break;
          }
          case "sign": {
            const event: BgEventData = {
              type: "sign",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              player_facing_dir: params.player_facing_dir ?? "BG_EVENT_PLAYER_FACING_ANY",
              script: params.script ?? "",
            };
            eventIndex = addBgEvent(mapData, event);
            break;
          }
          case "hidden_item": {
            const event: BgEventData = {
              type: "hidden_item",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              item: params.item ?? "ITEM_NONE",
              flag: params.flag ?? "0",
            };
            if (params.quantity !== undefined) event.quantity = params.quantity;
            if (params.underfoot !== undefined) event.underfoot = params.underfoot;
            eventIndex = addBgEvent(mapData, event);
            break;
          }
          case "secret_base": {
            const event: BgEventData = {
              type: "secret_base",
              x: params.x,
              y: params.y,
              elevation: params.elevation ?? 0,
              secret_base_id: params.secret_base_id ?? "SECRET_BASE_RED_CAVE1_1",
            };
            eventIndex = addBgEvent(mapData, event);
            break;
          }
          default:
            return {
              content: [{ type: "text" as const, text: `Error: Unknown event type: ${params.event_type}` }],
              isError: true,
            };
        }

        writeMapJson(project.getMapJsonPath(params.map), mapData);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, event_type: params.event_type, event_index: eventIndex }, null, 2),
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "update_event",
    "Update fields of an existing event by its group (object/warp/coord/bg) and index.",
    {
      map: z.string().describe("Map name"),
      event_group: z.enum(["object", "warp", "coord", "bg"]).describe("Event group"),
      index: z.number().int().min(0).describe("Event index within the group"),
      updates: z
        .record(z.string(), z.unknown())
        .describe("Fields to update (e.g. {x: 5, y: 10, script: 'MyScript'})"),
    },
    async ({ map, event_group, index, updates }) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(map);
        updateEvent(mapData, event_group, index, updates as Record<string, unknown>);
        writeMapJson(project.getMapJsonPath(map), mapData);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, event_group, index, updated_fields: Object.keys(updates) }, null, 2),
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "remove_event",
    "Remove an event from a map by its group (object/warp/coord/bg) and index.",
    {
      map: z.string().describe("Map name"),
      event_group: z.enum(["object", "warp", "coord", "bg"]).describe("Event group"),
      index: z.number().int().min(0).describe("Event index within the group"),
    },
    async ({ map, event_group, index }) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(map);
        removeEvent(mapData, event_group, index);
        writeMapJson(project.getMapJsonPath(map), mapData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, removed: { event_group, index } }, null, 2) }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
