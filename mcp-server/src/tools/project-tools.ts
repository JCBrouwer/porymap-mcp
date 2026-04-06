import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ProjectContext } from "../project.js";
import type { ConstantType } from "../types.js";
import { McpError } from "../utils.js";

// Server-level state: the current open project
let currentProject: ProjectContext | null = null;

export function getProject(): ProjectContext {
  if (!currentProject) {
    throw new McpError("NO_PROJECT", "No project is open. Call open_project first.");
  }
  return currentProject;
}

/** For testing only: inject a ProjectContext without going through open_project. */
export function setProject(project: ProjectContext | null): void {
  currentProject = project;
}

export function registerProjectTools(server: McpServer): void {
  server.tool(
    "open_project",
    "Open a Pokemon decompilation project directory. Must be called before any other tools.",
    { project_path: z.string().describe("Absolute path to the decompilation project root") },
    async ({ project_path }) => {
      try {
        currentProject = new ProjectContext(project_path);
        const info = currentProject.getProjectInfo();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(info, null, 2),
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
    "get_project_info",
    "Get information about the currently open project.",
    {},
    async () => {
      try {
        const project = getProject();
        const info = project.getProjectInfo();
        return {
          content: [{ type: "text" as const, text: JSON.stringify(info, null, 2) }],
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
    "list_maps",
    "List all maps in the project, optionally filtered by group name.",
    {
      group: z.string().optional().describe("Filter maps by group name"),
    },
    async ({ group }) => {
      try {
        const project = getProject();
        let maps = project.getMapList();
        if (group) {
          maps = maps.filter((m) => m.group === group);
        }
        // Enrich with map IDs from map.json
        const result = maps.map((m) => {
          try {
            const mapJson = project.readMapJson(m.name);
            return { name: m.name, id: mapJson.id, group: m.group, layout: mapJson.layout };
          } catch {
            return { name: m.name, id: null, group: m.group, layout: null };
          }
        });
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
    "list_constants",
    "List available constant values for a given type (species, items, flags, vars, weather, songs, movement_types, map_types, battle_scenes, trainer_types, obj_event_gfx, metatile_behaviors, sign_facing_directions, secret_bases).",
    {
      type: z
        .enum([
          "species",
          "items",
          "flags",
          "vars",
          "weather",
          "songs",
          "movement_types",
          "map_types",
          "battle_scenes",
          "trainer_types",
          "obj_event_gfx",
          "metatile_behaviors",
          "sign_facing_directions",
          "secret_bases",
        ])
        .describe("The type of constants to list"),
      filter: z
        .string()
        .optional()
        .describe("Optional substring filter (case-insensitive)"),
    },
    async ({ type, filter }) => {
      try {
        const project = getProject();
        let constants = project.getConstants(type as ConstantType);
        if (filter) {
          const upper = filter.toUpperCase();
          constants = constants.filter((c) => c.toUpperCase().includes(upper));
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ type, count: constants.length, constants }, null, 2),
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
    "list_tilesets",
    "List all available tilesets, optionally filtered by type.",
    {
      type: z
        .enum(["primary", "secondary"])
        .optional()
        .describe("Filter by tileset type"),
    },
    async ({ type }) => {
      try {
        const project = getProject();
        let tilesets = project.getTilesets();
        if (type === "primary") {
          tilesets = tilesets.filter((t) => !t.isSecondary);
        } else if (type === "secondary") {
          tilesets = tilesets.filter((t) => t.isSecondary);
        }
        const result = tilesets.map((t) => ({
          name: t.name,
          type: t.isSecondary ? "secondary" : "primary",
        }));
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
