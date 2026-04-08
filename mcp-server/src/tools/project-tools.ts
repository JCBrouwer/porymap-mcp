import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ProjectContext } from "../project.js";
import type { ConstantType } from "../types.js";
import { McpError } from "../utils.js";

// Server-level state: Map of server instances to their project contexts
// Each server gets isolated state via a unique symbol
const serverProjects = new Map<symbol, ProjectContext | null>();

function getServerKey(server: McpServer): symbol {
  // Use the server object identity as the key
  return Symbol.for(server.toString());
}

export function getProject(server: McpServer): ProjectContext {
  const key = getServerKey(server);
  const project = serverProjects.get(key);
  if (!project) {
    throw new McpError("NO_PROJECT", "No project is open. Call open_project first.");
  }
  return project;
}

export function setProject(server: McpServer, project: ProjectContext | null): void {
  const key = getServerKey(server);
  serverProjects.set(key, project);
}

/** For testing only: clear all project state. */
export function clearAllProjects(): void {
  serverProjects.clear();
}

export function registerProjectTools(server: McpServer): void {
  server.tool(
    "open_project",
    "Open a Pokemon decompilation project directory. Must be called before any other tools.",
    { project_path: z.string().describe("Absolute path to the decompilation project root") },
    async ({ project_path }) => {
      try {
        const project = new ProjectContext(project_path);
        setProject(server, project);
        const info = project.getProjectInfo();
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
    "close_project",
    "Close the currently open project. Call open_project again to work with a different project.",
    {},
    async () => {
      try {
        const key = getServerKey(server);
        const wasOpen = serverProjects.get(key) !== undefined;
        setProject(server, null);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, was_open: wasOpen }, null, 2),
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
        const project = getProject(server);
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
        const project = getProject(server);
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
        const project = getProject(server);
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
        const project = getProject(server);
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
