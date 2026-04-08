import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  readWildEncounters,
  writeWildEncounters,
  getEncountersForMap,
  getEncounterFieldDefs,
  getFieldEncounters,
  setFieldEncounters,
  removeFieldEncounters,
} from "../data/wild-encounters.js";
import type { WildEncounterMon } from "../types.js";

const monSchema = z.object({
  species: z.string().describe("Species constant (e.g. 'SPECIES_BULBASAUR')"),
  min_level: z.number().int().min(0).describe("Minimum encounter level"),
  max_level: z.number().int().min(0).describe("Maximum encounter level"),
});

export function registerEncounterTools(server: McpServer): void {
  server.tool(
    "get_wild_encounters",
    "Get wild encounter data for a map.",
    { map: z.string().describe("Map name") },
    async ({ map }) => {
      try {
        const project = getProject(server);
        const data = project.readWildEncounters();
        if (!data) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No wild encounters file found" }, null, 2) }],
          };
        }

        // Get the map constant
        const mapJson = project.readMapJson(map);
        const mapConstant = mapJson.id;

        const entry = getEncountersForMap(data, mapConstant);
        if (!entry) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ map, map_constant: mapConstant, encounters: null, message: "No encounters defined for this map" }, null, 2),
              },
            ],
          };
        }

        // Get field definitions for context
        const fieldDefs = getEncounterFieldDefs(data);
        const fields: Record<string, unknown> = {};
        for (const def of fieldDefs) {
          const fieldData = getFieldEncounters(entry, def.type);
          if (fieldData) {
            fields[def.type] = fieldData;
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ map, map_constant: mapConstant, fields }, null, 2),
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
    "set_wild_encounters",
    "Set wild encounter data for a specific field type (land, water, rock_smash, fishing) on a map. Creates the entry if it doesn't exist.",
    {
      map: z.string().describe("Map name"),
      field_type: z.string().describe("Encounter field type (e.g. 'land', 'water', 'fishing')"),
      encounter_rate: z.number().int().min(0).describe("Encounter rate"),
      mons: z.array(monSchema).describe("Array of encounter slot entries"),
    },
    async ({ map, field_type, encounter_rate, mons }) => {
      try {
        const project = getProject(server);
        const filepath = project.resolve(project.paths.json_wild_encounters);
        const data = readWildEncounters(filepath);

        const mapJson = project.readMapJson(map);
        const mapConstant = mapJson.id;
        const baseLabel = `g${map}WildMons`;

        setFieldEncounters(
          data,
          mapConstant,
          baseLabel,
          field_type,
          encounter_rate,
          mons as WildEncounterMon[],
        );

        writeWildEncounters(filepath, data);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, map, field_type, encounter_rate, slots: mons.length },
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
    "remove_wild_encounters",
    "Remove encounter data for a specific field type from a map. If the map has no remaining encounter fields after removal, the entire map entry is deleted.",
    {
      map: z.string().describe("Map name"),
      field_type: z.string().describe("Encounter field type to remove (e.g. 'land', 'water')"),
    },
    async ({ map, field_type }) => {
      try {
        const project = getProject(server);
        const filepath = project.resolve(project.paths.json_wild_encounters);
        if (!project.readWildEncounters()) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No wild encounters file found" }, null, 2) }],
          };
        }
        const data = readWildEncounters(filepath);
        const mapJson = project.readMapJson(map);
        const mapConstant = mapJson.id;
        const removed = removeFieldEncounters(data, mapConstant, field_type);
        if (removed) writeWildEncounters(filepath, data);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, map, map_constant: mapConstant, field_type, removed }, null, 2),
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
    "get_encounter_fields",
    "Get the encounter field definitions (slot counts, encounter rates) for the project.",
    {},
    async () => {
      try {
        const project = getProject(server);
        const data = project.readWildEncounters();
        if (!data) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "No wild encounters file found" }, null, 2) }],
          };
        }
        const fields = getEncounterFieldDefs(data);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(fields, null, 2) }],
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
