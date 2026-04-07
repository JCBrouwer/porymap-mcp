import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  readHealLocations,
  writeHealLocations,
  getHealLocationsForMap,
  setHealLocation,
  removeHealLocation,
} from "../data/heal-locations.js";
import { fileExists } from "../utils.js";

export function registerHealLocationTools(server: McpServer): void {
  server.tool(
    "get_heal_locations",
    "Get heal location data (respawn points). Optionally filter by map name or map constant.",
    {
      map: z.string().optional().describe("Map name or constant to filter by (returns all heal locations if omitted)"),
    },
    async ({ map }) => {
      try {
        const project = getProject();
        const filepath = project.resolve(project.paths.json_heal_locations);
        if (!fileExists(filepath)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No heal locations file found" }, null, 2) }],
          };
        }
        const data = readHealLocations(filepath);

        if (map) {
          const mapConstant = project.readMapJson(map).id;
          const locations = getHealLocationsForMap(data, mapConstant);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ map, map_constant: mapConstant, count: locations.length, heal_locations: locations }, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ count: data.heal_locations.length, heal_locations: data.heal_locations }, null, 2),
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
    "set_heal_location",
    "Create or update a heal location (respawn point). Uses the id field to match existing entries.",
    {
      id: z.string().describe("Heal location identifier (e.g. 'HEAL_LOCATION_LITTLEROOT_TOWN')"),
      map: z.string().describe("Map name or constant where the heal location tile is"),
      x: z.number().int().min(0).describe("X coordinate of the heal tile"),
      y: z.number().int().min(0).describe("Y coordinate of the heal tile"),
      respawn_map: z.string().optional().describe("Map to respawn on (FireRed/LeafGreen)"),
      respawn_npc: z.string().optional().describe("NPC local ID to face after respawn (FireRed/LeafGreen)"),
    },
    async ({ id, map, x, y, respawn_map, respawn_npc }) => {
      try {
        const project = getProject();
        const filepath = project.resolve(project.paths.json_heal_locations);
        if (!fileExists(filepath)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No heal locations file found" }, null, 2) }],
          };
        }
        const data = readHealLocations(filepath);
        const mapConstant = project.readMapJson(map).id;
        const location = {
          id,
          map: mapConstant,
          x,
          y,
          ...(respawn_map !== undefined ? { respawn_map } : {}),
          ...(respawn_npc !== undefined ? { respawn_npc } : {}),
        };
        setHealLocation(data, location);
        writeHealLocations(filepath, data);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, heal_location: location }, null, 2),
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
    "remove_heal_location",
    "Remove a heal location by its identifier.",
    {
      id: z.string().describe("Heal location identifier to remove"),
    },
    async ({ id }) => {
      try {
        const project = getProject();
        const filepath = project.resolve(project.paths.json_heal_locations);
        if (!fileExists(filepath)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No heal locations file found" }, null, 2) }],
          };
        }
        const data = readHealLocations(filepath);
        const removed = removeHealLocation(data, id);
        if (removed) writeHealLocations(filepath, data);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, id, removed }, null, 2),
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
