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
        const project = getProject(server);
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
        const project = getProject(server);
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
        const project = getProject(server);
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

  server.tool(
    "remove_connection_mirror",
    "Remove the mirror connection from the target map. Given a source map and direction, finds the connection and removes its mirror from the target map.",
    {
      map: z.string().describe("Source map name"),
      direction: z
        .enum(["up", "down", "left", "right", "dive", "emerge"])
        .describe("Connection direction"),
    },
    async ({ map, direction }) => {
      try {
        const project = getProject(server);
        const mapData = project.readMapJson(map);
        const connections = mapData.connections ?? [];

        // Find the connection with matching direction
        let sourceConnection: ConnectionData | null = null;
        let sourceIndex = -1;
        for (let i = 0; i < connections.length; i++) {
          if (connections[i].direction === direction) {
            sourceConnection = connections[i];
            sourceIndex = i;
            break;
          }
        }

        if (!sourceConnection) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `No ${direction} connection found on ${map}` }, null, 2) }],
            isError: true,
          };
        }

        const revDir = reverseDirection(direction);
        if (!revDir) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ success: false, error: `Cannot reverse direction: ${direction}` }, null, 2) }],
            isError: true,
          };
        }

        // Remove the mirror from target map
        let mirrorRemoved = false;
        let mirrorIndex = -1;
        try {
          const targetMapName = project.resolveMapName(sourceConnection.map);
          const targetData = project.readMapJson(targetMapName);
          const targetConnections = targetData.connections ?? [];

          // Find mirror connection (points back to source, has reverse direction)
          for (let i = 0; i < targetConnections.length; i++) {
            const conn = targetConnections[i];
            if (conn.map === mapData.id && conn.direction === revDir) {
              mirrorIndex = i;
              removeConnection(targetData, i);
              writeMapJson(project.getMapJsonPath(targetMapName), targetData);
              mirrorRemoved = true;
              break;
            }
          }
        } catch (mirrorErr) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: `Failed to remove mirror: ${(mirrorErr as Error).message}` },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  source_connection: { map, direction, target_map: sourceConnection.map, index: sourceIndex },
                  mirror_removed: mirrorRemoved,
                  mirror_index: mirrorRemoved ? mirrorIndex : null,
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
}
