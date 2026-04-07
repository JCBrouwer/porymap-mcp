import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  addConnection,
  updateConnection,
  removeConnection,
  reverseDirection,
  writeMapJson,
} from "../data/map-json.js";
import type { ConnectionData } from "../types.js";

export function registerConnectionTools(server: McpServer): void {
  server.tool(
    "add_connection",
    "Add a map connection. Optionally creates a mirror connection on the target map.",
    {
      map: z.string().describe("Source map name"),
      direction: z
        .enum(["up", "down", "left", "right", "dive", "emerge"])
        .describe("Connection direction"),
      target_map: z.string().describe("Target map constant (e.g. 'MAP_ROUTE_104')"),
      offset: z.number().int().optional().describe("Offset in metatiles (default: 0)"),
      mirror: z
        .boolean()
        .optional()
        .describe("Also create reverse connection on target map (default: true)"),
    },
    async ({ map, direction, target_map, offset, mirror }) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(map);
        const connection: ConnectionData = {
          map: target_map,
          direction,
          offset: offset ?? 0,
        };
        addConnection(mapData, connection);
        writeMapJson(project.getMapJsonPath(map), mapData);

        // Mirror connection
        const shouldMirror = mirror ?? true;
        let mirrored = false;
        let mirrorWarning: string | undefined;
        if (shouldMirror) {
          const revDir = reverseDirection(direction);
          if (revDir) {
            try {
              // Resolve target map name from constant
              const targetMapName = project.resolveMapName(target_map);
              const targetData = project.readMapJson(targetMapName);
              const sourceMapJson = project.readMapJson(map);
              const mirrorConnection: ConnectionData = {
                map: sourceMapJson.id,
                direction: revDir,
                offset: -(offset ?? 0),
              };
              addConnection(targetData, mirrorConnection);
              writeMapJson(project.getMapJsonPath(targetMapName), targetData);
              mirrored = true;
            } catch (mirrorErr) {
              mirrorWarning = `Mirror connection skipped: ${(mirrorErr as Error).message}`;
            }
          }
        }

        const result: Record<string, unknown> = { success: true, connection, mirrored };
        if (mirrorWarning) result.mirror_warning = mirrorWarning;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
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
    "update_connection",
    "Update an existing connection by index.",
    {
      map: z.string().describe("Map name"),
      index: z.number().int().min(0).describe("Connection index"),
      direction: z.enum(["up", "down", "left", "right", "dive", "emerge"]).optional(),
      target_map: z.string().optional().describe("New target map constant"),
      offset: z.number().int().optional().describe("New offset"),
    },
    async ({ map, index, direction, target_map, offset }) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(map);
        const updates: Partial<ConnectionData> = {};
        if (direction !== undefined) updates.direction = direction;
        if (target_map !== undefined) updates.map = target_map;
        if (offset !== undefined) updates.offset = offset;
        updateConnection(mapData, index, updates);
        writeMapJson(project.getMapJsonPath(map), mapData);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, index, updated_fields: Object.keys(updates) }, null, 2),
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
    "remove_connection",
    "Remove a connection by index.",
    {
      map: z.string().describe("Map name"),
      index: z.number().int().min(0).describe("Connection index"),
    },
    async ({ map, index }) => {
      try {
        const project = getProject();
        const mapData = project.readMapJson(map);
        removeConnection(mapData, index);
        writeMapJson(project.getMapJsonPath(map), mapData);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, removed_index: index }, null, 2) }],
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
