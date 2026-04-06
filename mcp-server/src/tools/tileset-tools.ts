import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  searchMetatileLabels,
  getLabelsForTileset,
} from "../data/metatile-labels.js";

export function registerTilesetTools(server: McpServer): void {
  server.tool(
    "get_metatile_labels",
    "Get metatile label-to-ID mappings for a tileset, or search labels by pattern.",
    {
      tileset: z.string().optional().describe("Tileset name to get labels for (e.g. 'General', 'gTileset_General')"),
      pattern: z.string().optional().describe("Search pattern (case-insensitive substring match, e.g. 'GRASS', 'DOOR')"),
    },
    async ({ tileset, pattern }) => {
      try {
        const project = getProject();
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
