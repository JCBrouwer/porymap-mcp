import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import { updateMapHeader, writeMapJson, createDefaultMapJson } from "../data/map-json.js";
import {
  setMapBlocks,
  fillMapBlocks,
  resizeLayout,
  shiftMapBlocks,
  setBorderBlocks,
  createBlockdata,
  addLayout,
  writeLayouts,
} from "../data/layouts.js";
import {
  addMapToGroup,
  writeMapGroups,
} from "../data/map-groups.js";
import {
  mapNameToConstant,
  layoutNameToConstant,
  ensureDir,
  writeJsonFile,
} from "../utils.js";
import type { Layout, PositionedBlock } from "../types.js";

const blockSchema = z.object({
  x: z.number().int().describe("X coordinate"),
  y: z.number().int().describe("Y coordinate"),
  metatile_id: z.number().int().min(0).describe("Metatile ID"),
  collision: z.number().int().min(0).max(3).optional().describe("Collision value (0-3, default: 0)"),
  elevation: z.number().int().min(0).max(15).optional().describe("Elevation value (0-15, default: 3)"),
});

export function registerMapWriteTools(server: McpServer): void {
  server.tool(
    "set_map_header",
    "Update one or more map header fields (music, weather, type, flags, etc.).",
    {
      map: z.string().describe("Map name"),
      music: z.string().optional().describe("Background music constant"),
      location: z.string().optional().describe("Region map section constant"),
      weather: z.string().optional().describe("Weather constant"),
      map_type: z.string().optional().describe("Map type constant"),
      battle_scene: z.string().optional().describe("Battle scene constant"),
      requires_flash: z.boolean().optional().describe("Whether map requires Flash"),
      show_location_name: z.boolean().optional().describe("Show location name popup"),
      allow_running: z.boolean().optional().describe("Allow running"),
      allow_biking: z.boolean().optional().describe("Allow biking"),
      allow_escaping: z.boolean().optional().describe("Allow Escape Rope / Dig"),
      floor_number: z.number().int().optional().describe("Floor number (-128 to 127)"),
    },
    async ({ map, music, location, weather, map_type, battle_scene, requires_flash, show_location_name, allow_running, allow_biking, allow_escaping, floor_number }) => {
      try {
        const project = getProject(server);
        const mapData = project.readMapJson(map);
        const updates: Record<string, unknown> = {};
        if (music !== undefined) updates.music = music;
        if (location !== undefined) updates.region_map_section = location;
        if (weather !== undefined) updates.weather = weather;
        if (map_type !== undefined) updates.map_type = map_type;
        if (battle_scene !== undefined) updates.battle_scene = battle_scene;
        if (requires_flash !== undefined) updates.requires_flash = requires_flash;
        if (show_location_name !== undefined) updates.show_map_name = show_location_name;
        if (allow_running !== undefined) updates.allow_running = allow_running;
        if (allow_biking !== undefined) updates.allow_cycling = allow_biking;
        if (allow_escaping !== undefined) updates.allow_escaping = allow_escaping;
        if (floor_number !== undefined) updates.floor_number = floor_number;

        updateMapHeader(mapData, updates);
        writeMapJson(project.getMapJsonPath(map), mapData);

        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, updated_fields: Object.keys(updates) }, null, 2) }],
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
    "set_blocks",
    "Set one or more blocks at specific positions on a map.",
    {
      map: z.string().describe("Map name"),
      blocks: z.array(blockSchema).min(1).describe("Array of blocks to set"),
    },
    async ({ map, blocks }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);
        const positioned: PositionedBlock[] = blocks.map((b) => ({
          x: b.x,
          y: b.y,
          metatileId: b.metatile_id,
          collision: b.collision ?? 0,
          elevation: b.elevation ?? 3,
        }));
        const count = setMapBlocks(project.root, layout, positioned);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, blocks_set: count }, null, 2) }],
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
    "fill_region",
    "Fill a rectangular region with a single metatile.",
    {
      map: z.string().describe("Map name"),
      x: z.number().int().describe("Start X coordinate"),
      y: z.number().int().describe("Start Y coordinate"),
      width: z.number().int().min(1).describe("Region width"),
      height: z.number().int().min(1).describe("Region height"),
      metatile_id: z.number().int().min(0).describe("Metatile ID to fill with"),
      collision: z.number().int().min(0).max(3).optional().describe("Collision value (default: 0)"),
      elevation: z.number().int().min(0).max(15).optional().describe("Elevation value (default: 3)"),
    },
    async ({ map, x, y, width, height, metatile_id, collision, elevation }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);
        const count = fillMapBlocks(
          project.root,
          layout,
          x,
          y,
          width,
          height,
          metatile_id,
          collision ?? 0,
          elevation ?? 3,
        );
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, blocks_filled: count }, null, 2) }],
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
    "resize_map",
    "Change map dimensions. Preserves existing blocks, fills new space with a default metatile.",
    {
      map: z.string().describe("Map name"),
      width: z.number().int().min(1).describe("New width in metatiles"),
      height: z.number().int().min(1).describe("New height in metatiles"),
      fill_metatile_id: z.number().int().optional().describe("Metatile for new space (default: 0)"),
      fill_collision: z.number().int().optional().describe("Collision for new space (default: 0)"),
      fill_elevation: z.number().int().optional().describe("Elevation for new space (default: 3)"),
    },
    async ({ map, width, height, fill_metatile_id, fill_collision, fill_elevation }) => {
      try {
        const project = getProject(server);
        const { layout, layoutsData } = project.getLayoutForMap(map);
        const oldWidth = layout.width;
        const oldHeight = layout.height;

        resizeLayout(
          project.root,
          layout,
          width,
          height,
          fill_metatile_id ?? 0,
          fill_collision ?? 0,
          fill_elevation ?? 3,
        );

        // Update layout dimensions in layouts.json
        layout.width = width;
        layout.height = height;
        writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, old_width: oldWidth, old_height: oldHeight, new_width: width, new_height: height },
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
    "shift_map",
    "Shift all map blocks by a delta, filling exposed edges with a default metatile.",
    {
      map: z.string().describe("Map name"),
      x_delta: z.number().int().describe("Horizontal shift (positive = right)"),
      y_delta: z.number().int().describe("Vertical shift (positive = down)"),
      fill_metatile_id: z.number().int().optional().describe("Fill metatile for edges (default: 0)"),
    },
    async ({ map, x_delta, y_delta, fill_metatile_id }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);

        // Validate delta values to prevent entire map replacement
        if (Math.abs(x_delta) >= layout.width || Math.abs(y_delta) >= layout.height) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    error: `Delta values too large: x_delta=${x_delta} (map width=${layout.width}), y_delta=${y_delta} (map height=${layout.height}). Delta magnitude must be less than map dimensions.`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        shiftMapBlocks(project.root, layout, x_delta, y_delta, fill_metatile_id ?? 0);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true, shifted: { x_delta, y_delta } }, null, 2) }],
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
    "set_border",
    "Set border blocks for a map.",
    {
      map: z.string().describe("Map name"),
      blocks: z.array(blockSchema).min(1).describe("Border blocks to set"),
    },
    async ({ map, blocks }) => {
      try {
        const project = getProject(server);
        const { layout } = project.getLayoutForMap(map);
        const positioned: PositionedBlock[] = blocks.map((b) => ({
          x: b.x,
          y: b.y,
          metatileId: b.metatile_id,
          collision: b.collision ?? 0,
          elevation: b.elevation ?? 0,
        }));
        setBorderBlocks(project.root, layout, positioned);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ success: true }, null, 2) }],
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
    "set_tilesets",
    "Change primary and/or secondary tileset for a map's layout.",
    {
      map: z.string().describe("Map name"),
      primary_tileset: z.string().optional().describe("Primary tileset name (e.g. 'gTileset_General')"),
      secondary_tileset: z.string().optional().describe("Secondary tileset name"),
    },
    async ({ map, primary_tileset, secondary_tileset }) => {
      try {
        const project = getProject(server);
        const { layout, layoutsData } = project.getLayoutForMap(map);
        if (primary_tileset) layout.primary_tileset = primary_tileset;
        if (secondary_tileset) layout.secondary_tileset = secondary_tileset;
        writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  primary_tileset: layout.primary_tileset,
                  secondary_tileset: layout.secondary_tileset,
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
    "create_map",
    "Create a new map with layout, registering it in map_groups.json and layouts.json. Creates map.json, blockdata, and border files.",
    {
      name: z.string().describe("Map name (e.g. 'MyNewRoute')"),
      group: z.string().describe("Map group to add to"),
      width: z.number().int().min(1).describe("Map width in metatiles"),
      height: z.number().int().min(1).describe("Map height in metatiles"),
      primary_tileset: z.string().describe("Primary tileset (e.g. 'gTileset_General')"),
      secondary_tileset: z.string().describe("Secondary tileset"),
      fill_metatile_id: z.number().int().optional().describe("Fill metatile (default: 0)"),
      border_metatile_id: z.number().int().optional().describe("Border metatile (default: 0)"),
      music: z.string().optional(),
      location: z.string().optional(),
      weather: z.string().optional(),
      map_type: z.string().optional(),
      battle_scene: z.string().optional(),
      show_map_name: z.boolean().optional(),
      allow_running: z.boolean().optional(),
      allow_biking: z.boolean().optional(),
      allow_escaping: z.boolean().optional(),
    },
    async (params) => {
      try {
        const project = getProject(server);
        const mapName = params.name;
        const mapId = mapNameToConstant(mapName);
        const layoutId = layoutNameToConstant(mapName);
        const layoutName = mapName;

        // Create layout entry
        const layoutsData = project.readLayouts();
        const layoutFolder = path.join(project.paths.data_layouts_folders, layoutName);
        const newLayout: Layout = {
          id: layoutId,
          name: layoutName,
          width: params.width,
          height: params.height,
          border_width: 2,
          border_height: 2,
          primary_tileset: params.primary_tileset,
          secondary_tileset: params.secondary_tileset,
          border_filepath: path.join(layoutFolder, "border.bin"),
          blockdata_filepath: path.join(layoutFolder, "map.bin"),
        };
        addLayout(layoutsData, newLayout);
        writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

        // Create blockdata files
        createBlockdata(
          project.root,
          newLayout,
          params.fill_metatile_id ?? 0,
          params.border_metatile_id ?? 0,
        );

        // Create map.json
        const mapFolder = path.join(project.paths.data_map_folders, mapName);
        ensureDir(project.resolve(mapFolder));
        const mapJson = createDefaultMapJson(mapName, mapId, layoutId, {
          music: params.music,
          location: params.location,
          weather: params.weather,
          mapType: params.map_type,
          battleScene: params.battle_scene,
          showMapName: params.show_map_name,
          allowRunning: params.allow_running,
          allowBiking: params.allow_biking,
          allowEscaping: params.allow_escaping,
        });
        writeJsonFile(project.resolve(path.join(mapFolder, "map.json")), mapJson);

        // Add to map groups
        const mapGroups = project.readMapGroups();
        addMapToGroup(mapGroups, mapName, params.group);
        writeMapGroups(project.resolve(project.paths.json_map_groups), mapGroups);

        // Create empty scripts file
        const scriptsPath = project.resolve(path.join(mapFolder, "scripts.inc"));
        const fs = await import("node:fs");
        fs.writeFileSync(scriptsPath, `${mapName}_MapScripts::\n\t.byte 0\n`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { success: true, map_name: mapName, map_id: mapId, layout_id: layoutId },
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
