import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import { findMapsWithSpecies, readWildEncounters } from "../data/wild-encounters.js";
import { getAllEvents } from "../data/map-json.js";

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "find_maps_using_species",
    "Find all maps with a given species in their wild encounters.",
    {
      species: z.string().describe("Species constant (e.g. 'SPECIES_PIKACHU')"),
    },
    async ({ species }) => {
      try {
        const project = getProject();
        const data = project.readWildEncounters();
        if (!data) {
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ species, results: [], message: "No wild encounters file" }, null, 2) },
            ],
          };
        }
        const results = findMapsWithSpecies(data, species);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ species, count: results.length, results }, null, 2),
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
    "search_events_across_maps",
    "Search for events matching criteria across all maps. Useful for finding specific scripts, NPCs, items, etc.",
    {
      event_type: z
        .enum(["object", "warp", "trigger", "weather_trigger", "sign", "hidden_item", "secret_base"])
        .optional()
        .describe("Filter by event type"),
      script_pattern: z.string().optional().describe("Substring match on script field"),
      flag: z.string().optional().describe("Exact match on flag field"),
      item: z.string().optional().describe("Exact match on item field (hidden items)"),
      graphics_id: z.string().optional().describe("Exact match on graphics_id (object events)"),
      limit: z.number().int().optional().describe("Max results (default: 50)"),
    },
    async ({ event_type, script_pattern, flag, item, graphics_id, limit }) => {
      try {
        const project = getProject();
        const maps = project.getMapList();
        const maxResults = limit ?? 50;
        const results: Array<{
          map: string;
          event_group: string;
          index: number;
          event: unknown;
        }> = [];
        const skippedMaps: string[] = [];

        for (const mapEntry of maps) {
          if (results.length >= maxResults) break;

          let mapData;
          try {
            mapData = project.readMapJson(mapEntry.name);
          } catch {
            skippedMaps.push(mapEntry.name);
            continue;
          }

          const allEvents = getAllEvents(mapData);

          // Search each event group
          const groups = [
            { name: "object", events: allEvents.object_events },
            { name: "warp", events: allEvents.warp_events },
            { name: "coord", events: allEvents.coord_events },
            { name: "bg", events: allEvents.bg_events },
          ];

          for (const group of groups) {
            for (let i = 0; i < group.events.length; i++) {
              if (results.length >= maxResults) break;

              const event = group.events[i] as Record<string, unknown>;

              // Filter by event type
              if (event_type) {
                if (group.name === "coord" && event.type !== event_type) continue;
                if (group.name === "bg" && event.type !== event_type) continue;
                if (group.name === "object" && event_type !== "object") continue;
                if (group.name === "warp" && event_type !== "warp") continue;
              }

              // Filter by script pattern
              if (
                script_pattern &&
                typeof event.script === "string" &&
                !event.script.toUpperCase().includes(script_pattern.toUpperCase())
              ) {
                continue;
              }
              if (script_pattern && typeof event.script !== "string") continue;

              // Filter by flag
              if (flag && event.flag !== flag) continue;

              // Filter by item
              if (item && event.item !== item) continue;

              // Filter by graphics_id
              if (graphics_id && event.graphics_id !== graphics_id) continue;

              results.push({
                map: mapEntry.name,
                event_group: group.name,
                index: i,
                event,
              });
            }
          }
        }

        const response: Record<string, unknown> = { count: results.length, results };
        if (skippedMaps.length > 0) response.skipped_maps = skippedMaps;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
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
