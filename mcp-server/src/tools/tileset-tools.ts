import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  searchMetatileLabels,
  getLabelsForTileset,
} from "../data/metatile-labels.js";
import { findLayout } from "../data/layouts.js";

export function registerTilesetTools(server: McpServer): void {
  server.tool(
    "list_layouts",
    "List all map layouts defined in layouts.json.",
    {},
    async () => {
      try {
        const project = getProject(server);
        const layoutsData = project.readLayouts();
        const layouts = layoutsData.layouts.map((l) => ({
          id: l.id,
          name: l.name,
          width: l.width,
          height: l.height,
          primary_tileset: l.primary_tileset,
          secondary_tileset: l.secondary_tileset,
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ count: layouts.length, layouts }, null, 2) }],
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
    "get_layout",
    "Get detailed information about a specific map layout, including dimensions, tilesets, and file paths.",
    {
      layout_id: z.string().optional().describe("Layout ID or name (e.g. 'LAYOUT_PETALBURG_CITY')"),
      map: z.string().optional().describe("Map name — looks up the layout used by this map"),
    },
    async ({ layout_id, map }) => {
      try {
        const project = getProject(server);
        const layoutsData = project.readLayouts();
        let resolvedLayoutId = layout_id;

        if (!resolvedLayoutId) {
          if (!map) {
            return {
              content: [{ type: "text" as const, text: "Error: provide either layout_id or map" }],
              isError: true,
            };
          }
          const mapData = project.readMapJson(map);
          resolvedLayoutId = mapData.layout;
        }

        const layout = findLayout(layoutsData, resolvedLayoutId);
        if (!layout) {
          return {
            content: [{ type: "text" as const, text: `Error: Layout '${resolvedLayoutId}' not found` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(layout, null, 2) }],
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
    "get_metatile_labels",
    "Get metatile label-to-ID mappings for a tileset, or search labels by pattern.",
    {
      tileset: z.string().optional().describe("Tileset name to get labels for (e.g. 'General', 'gTileset_General')"),
      pattern: z.string().optional().describe("Search pattern (case-insensitive substring match, e.g. 'GRASS', 'DOOR')"),
    },
    async ({ tileset, pattern }) => {
      try {
        const project = getProject(server);
        const allLabels = project.getMetatileLabels();

        let results;
        if (pattern) {
          results = searchMetatileLabels(allLabels, pattern);
        } else if (tileset) {
          results = getLabelsForTileset(allLabels, tileset);
        } else {
          results = allLabels;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ count: results.length, labels: results }, null, 2),
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
