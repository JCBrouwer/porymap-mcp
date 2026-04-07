#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProjectTools } from "./tools/project-tools.js";
import { registerMapReadTools } from "./tools/map-read-tools.js";
import { registerMapWriteTools } from "./tools/map-write-tools.js";
import { registerEventTools } from "./tools/event-tools.js";
import { registerConnectionTools } from "./tools/connection-tools.js";
import { registerEncounterTools } from "./tools/encounter-tools.js";
import { registerTilesetTools } from "./tools/tileset-tools.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerHealLocationTools } from "./tools/heal-location-tools.js";

const server = new McpServer({
  name: "porymap-mcp",
  version: "0.1.0",
});

// Register all tool groups
registerProjectTools(server);
registerMapReadTools(server);
registerMapWriteTools(server);
registerEventTools(server);
registerConnectionTools(server);
registerEncounterTools(server);
registerTilesetTools(server);
registerSearchTools(server);
registerHealLocationTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
