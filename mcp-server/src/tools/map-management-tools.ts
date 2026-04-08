import * as path from "node:path";
import * as fs from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getProject } from "./project-tools.js";
import {
  findMapsWithConnectionTo,
  findConnectionIndicesTo,
  writeMapJson,
} from "../data/map-json.js";
import { removeMapFromGroup, writeMapGroups } from "../data/map-groups.js";
import {
  readLayouts,
  writeLayouts,
  removeLayout,
  readBorderBlocks,
} from "../data/layouts.js";
import { readBlockdata, writeBlockdata } from "../utils.js";
import { mapNameToConstant, layoutNameToConstant } from "../utils.js";
import type { Layout, Block } from "../types.js";

export function registerMapManagementTools(server: McpServer): void {
  server.tool(
    "delete_map",
    "Delete a map and clean up all references. Includes safety features: dry-run mode to preview changes, and automatic cleanup of incoming connections from other maps.",
    {
      map: z.string().describe("Map name to delete"),
      dry_run: z.boolean().optional().describe("Preview what will be deleted without making changes (default: false)"),
    },
    async ({ map, dry_run }) => {
      try {
        const project = getProject(server);
        const isDryRun = dry_run ?? false;

        // Get map info
        const mapData = project.readMapJson(map);
        const mapConstant = mapData.id;
        const mapJsonPath = project.getMapJsonPath(map);

        // Find incoming connections (maps that have connections pointing to this map)
        const incomingConnections = findMapsWithConnectionTo(project, mapConstant);

        // Get layout info
        const layoutsData = project.readLayouts();
        const layout = layoutsData.layouts.find((l) => l.id === mapData.layout);
        const layoutFolder = layout ? path.dirname(path.resolve(project.root, layout.blockdata_filepath)) : null;

        // Build report of what will be deleted/changed
        const report = {
          map_name: map,
          map_constant: mapConstant,
          layout_id: mapData.layout,
          files_to_delete: [] as string[],
          maps_with_incoming_connections: incomingConnections.map((c) => ({
            map_name: c.mapName,
            connection_index: c.connectionIndex,
            direction: c.direction,
          })),
          connections_to_remove: incomingConnections.length,
          will_delete_files: !isDryRun,
        };

        // Add files that will be deleted
        report.files_to_delete.push(mapJsonPath);
        if (layout) {
          const blockdataPath = path.resolve(project.root, layout.blockdata_filepath);
          const borderPath = path.resolve(project.root, layout.border_filepath);
          report.files_to_delete.push(blockdataPath);
          report.files_to_delete.push(borderPath);
        }
        if (layoutFolder) {
          report.files_to_delete.push(layoutFolder);
        }

        // Add scripts.inc path
        const mapFolder = path.join(project.paths.data_map_folders, map);
        const scriptsPath = project.resolve(path.join(mapFolder, "scripts.inc"));
        report.files_to_delete.push(scriptsPath);

        if (isDryRun) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    dry_run: true,
                    ...report,
                    message: "This is a preview. No changes have been made.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Remove incoming connections from other maps
        const cleanedConnections: Array<{ map: string; index: number }> = [];
        for (const incoming of incomingConnections) {
          try {
            const targetData = project.readMapJson(incoming.mapName);
            const indices = findConnectionIndicesTo(targetData, mapConstant);
            // Remove all connections pointing to this map (usually should be 1)
            for (const idx of indices.sort((a, b) => b - a)) {
              targetData.connections!.splice(idx, 1);
              cleanedConnections.push({ map: incoming.mapName, index: idx });
            }
            writeMapJson(project.getMapJsonPath(incoming.mapName), targetData);
          } catch (e) {
            // Continue with other cleanups even if one fails
          }
        }

        // Delete map.json
        if (fs.existsSync(mapJsonPath)) {
          fs.unlinkSync(mapJsonPath);
        }

        // Delete blockdata and border files
        if (layout) {
          const blockdataPath = path.resolve(project.root, layout.blockdata_filepath);
          const borderPath = path.resolve(project.root, layout.border_filepath);
          if (fs.existsSync(blockdataPath)) {
            fs.unlinkSync(blockdataPath);
          }
          if (fs.existsSync(borderPath)) {
            fs.unlinkSync(borderPath);
          }
          // Remove layout from layouts.json
          removeLayout(layoutsData, mapData.layout);
          writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);
          // Remove layout folder
          if (layoutFolder && fs.existsSync(layoutFolder)) {
            fs.rmdirSync(layoutFolder);
          }
        }

        // Delete scripts.inc
        if (fs.existsSync(scriptsPath)) {
          fs.unlinkSync(scriptsPath);
        }

        // Remove from map groups
        const mapGroups = project.readMapGroups();
        removeMapFromGroup(mapGroups, map);
        writeMapGroups(project.resolve(project.paths.json_map_groups), mapGroups);

        // Remove map folder if empty
        if (fs.existsSync(mapFolder) && fs.readdirSync(mapFolder).length === 0) {
          fs.rmdirSync(mapFolder);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  map_deleted: map,
                  connections_cleaned: cleanedConnections.length,
                  cleaned_connections: cleanedConnections,
                  files_deleted: report.files_to_delete,
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
    "clone_map",
    "Create a copy of an existing map with a new name. The clone has independent blockdata and layout.",
    {
      source_map: z.string().describe("Source map name to clone"),
      new_name: z.string().describe("Name for the new map"),
      group: z.string().describe("Map group to add the new map to"),
    },
    async ({ source_map, new_name, group }) => {
      try {
        const project = getProject(server);

        // Read source map
        const sourceMapData = project.readMapJson(source_map);
        const sourceMapConstant = sourceMapData.id;
        const { layout: sourceLayout, layoutsData } = project.getLayoutForMap(source_map);

        // Generate new IDs
        const newMapConstant = mapNameToConstant(new_name);
        const newLayoutId = layoutNameToConstant(new_name);

        // Check if new map already exists
        try {
          project.readMapJson(new_name);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: false, error: `Map '${new_name}' already exists` },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        } catch {
          // Expected: map doesn't exist
        }

        // Copy blockdata
        const sourceBlockdataPath = path.resolve(project.root, sourceLayout.blockdata_filepath);
        const sourceBorderPath = path.resolve(project.root, sourceLayout.border_filepath);
        const newLayoutFolder = path.join(project.paths.data_layouts_folders, new_name);
        const newBlockdataPath = path.join(newLayoutFolder, "map.bin");
        const newBorderPath = path.join(newLayoutFolder, "border.bin");

        // Ensure directory exists
        fs.mkdirSync(path.resolve(project.root, newLayoutFolder), { recursive: true });

        // Copy blockdata
        const sourceBlocks = readBlockdata(sourceBlockdataPath);
        writeBlockdata(path.resolve(project.root, newBlockdataPath), sourceBlocks);

        // Copy border
        const sourceBorder = readBorderBlocks(project.root, sourceLayout);
        const borderBuf = Buffer.alloc(sourceBorder.length * 2);
        for (let i = 0; i < sourceBorder.length; i++) {
          const b = sourceBorder[i];
          const raw =
            (b.metatileId & 0x3ff) |
            ((b.collision & 0x3) << 10) |
            ((b.elevation & 0xf) << 12);
          borderBuf.writeUInt16LE(raw, i * 2);
        }
        writeBlockdata(path.resolve(project.root, newBorderPath), sourceBorder);

        // Create new layout
        const newLayout: Layout = {
          id: newLayoutId,
          name: new_name,
          width: sourceLayout.width,
          height: sourceLayout.height,
          border_width: sourceLayout.border_width ?? 2,
          border_height: sourceLayout.border_height ?? 2,
          primary_tileset: sourceLayout.primary_tileset,
          secondary_tileset: sourceLayout.secondary_tileset,
          border_filepath: newBorderPath,
          blockdata_filepath: newBlockdataPath,
        };

        // Add layout to layouts.json
        layoutsData.layouts.push(newLayout);
        writeLayouts(project.resolve(project.paths.json_layouts), layoutsData);

        // Create map.json (copy of source with new name/ID/layout)
        const newMapJson = {
          ...sourceMapData,
          id: newMapConstant,
          name: new_name,
          layout: newLayoutId,
        };
        const newMapFolder = path.join(project.paths.data_map_folders, new_name);
        fs.mkdirSync(project.resolve(newMapFolder), { recursive: true });
        writeMapJson(project.resolve(path.join(newMapFolder, "map.json")), newMapJson as Parameters<typeof writeMapJson>[1]);

        // Add to map groups
        const mapGroups = project.readMapGroups();
        const { addMapToGroup, writeMapGroups: writeGroups } = await import("../data/map-groups.js");
        addMapToGroup(mapGroups, new_name, group);
        writeGroups(project.resolve(project.paths.json_map_groups), mapGroups);

        // Create scripts.inc stub
        const scriptsPath = project.resolve(path.join(newMapFolder, "scripts.inc"));
        fs.writeFileSync(scriptsPath, `${new_name}_MapScripts::\n\t.byte 0\n`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  new_map: new_name,
                  new_map_constant: newMapConstant,
                  new_layout_id: newLayoutId,
                  layout: {
                    width: newLayout.width,
                    height: newLayout.height,
                    primary_tileset: newLayout.primary_tileset,
                    secondary_tileset: newLayout.secondary_tileset,
                  },
                  events_copied: {
                    object_events: sourceMapData.object_events.length,
                    warp_events: sourceMapData.warp_events.length,
                    coord_events: sourceMapData.coord_events.length,
                    bg_events: sourceMapData.bg_events.length,
                  },
                  group,
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
