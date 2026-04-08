import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import { getMapHeader, getAllEvents, getConnections } from "../data/map-json.js";
import {
  readMapBlocks,
  readMapBlockRegion,
  readBorderBlocks,
} from "../data/layouts.js";

export function registerMapReadTools(server: McpServer): void {
  server.tool(
    "get_map_header",
    "Get a map's header properties (music, weather, type, flags, etc.).",
    { map: z.string().describe("Map name (e.g. 'PetalburgCity')") },
    async ({ map }) => {
      try {
        const project = getProject(server);
        const mapData = project.readMapJson(map);
        const header = getMapHeader(mapData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(header, null, 2) }],
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
    "get_map_blocks",
    "Read block data (metatile IDs, collision, elevation) for a map region or the full map.",
    {
      map: z.string().describe("Map name"),
      x: z.number().int().optional().describe("Start X coordinate (default: 0)"),
      y: z.number().int().optional().describe("Start Y coordinate (default: 0)"),
      width: z.number().int().optional().describe("Region width (default: full map width)"),
      height: z.number().int().optional().describe("Region height (default: full map height)"),
    },
    async ({ map, x, y, width, height }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);
        const rx = x ?? 0;
        const ry = y ?? 0;
        const rw = width ?? layout.width;
        const rh = height ?? layout.height;

        // Clip region to map bounds and report actual region
        const actualX = Math.max(0, rx);
        const actualY = Math.max(0, ry);
        const actualW = Math.min(rw, layout.width - actualX);
        const actualH = Math.min(rh, layout.height - actualY);

        const blocks =
          actualX === 0 && actualY === 0 && actualW === layout.width && actualH === layout.height
            ? readMapBlocks(project.root, layout)
            : readMapBlockRegion(project.root, layout, actualX, actualY, actualW, actualH);

        const responseData: Record<string, unknown> = {
          map_width: layout.width,
          map_height: layout.height,
          primary_tileset: layout.primary_tileset,
          secondary_tileset: layout.secondary_tileset,
          region: { x: actualX, y: actualY, width: actualW, height: actualH },
          blocks,
        };
        if (actualX !== rx || actualY !== ry || actualW !== rw || actualH !== rh) {
          responseData.clipped = true;
          responseData.requested_region = { x: rx, y: ry, width: rw, height: rh };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(responseData, null, 2),
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
    "get_map_border",
    "Read border block data for a map.",
    { map: z.string().describe("Map name") },
    async ({ map }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);
        const blocks = readBorderBlocks(project.root, layout);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  width: layout.border_width ?? 2,
                  height: layout.border_height ?? 2,
                  blocks,
                },
                null,
                2,
              ),
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
    "get_map_events",
    "Get all events on a map, optionally filtered by event type.",
    {
      map: z.string().describe("Map name"),
      event_type: z
        .enum([
          "object",
          "clone_object",
          "warp",
          "trigger",
          "weather_trigger",
          "sign",
          "hidden_item",
          "secret_base",
        ])
        .optional()
        .describe("Filter by event type"),
    },
    async ({ map, event_type }) => {
      try {
        const project = getProject(server);
        const mapData = project.readMapJson(map);

        if (event_type) {
          const { getEventsByType } = await import("../data/map-json.js");
          const events = getEventsByType(mapData, event_type);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ event_type, count: events.length, events }, null, 2),
              },
            ],
          };
        }

        const allEvents = getAllEvents(mapData);
        const summary = {
          object_events: { count: allEvents.object_events.length, events: allEvents.object_events },
          warp_events: { count: allEvents.warp_events.length, events: allEvents.warp_events },
          coord_events: { count: allEvents.coord_events.length, events: allEvents.coord_events },
          bg_events: { count: allEvents.bg_events.length, events: allEvents.bg_events },
        };
        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
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
    "get_map_connections",
    "Get all connections for a map.",
    { map: z.string().describe("Map name") },
    async ({ map }) => {
      try {
        const project = getProject(server);
        const mapData = project.readMapJson(map);
        const connections = getConnections(mapData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(connections, null, 2) }],
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
