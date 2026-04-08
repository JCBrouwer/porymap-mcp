# Porymap MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [Porymap](https://github.com/huderlem/porymap), the map editor for Pokemon Generation 3 decompilation projects (pokefirered, pokeemerald, etc.).

## Overview

This MCP server enables AI assistants to interact with Pokemon Gen 3 map data through a standardized protocol. It provides tools for reading and writing map data, managing events, connections, encounters, and more.

## Requirements

- Node.js 20+
- A Pokemon Gen 3 decompilation project (pokeemerald, pokefirered, etc.)

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### Running the Server

The server communicates over stdio. Configure your MCP client to use the built `dist/index.js`:

```bash
# Development mode
npm run dev

# Production mode  
npm run start
```

### Claude Desktop Configuration

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or similar on other platforms):

```json
{
  "mcpServers": {
    "porymap": {
      "command": "node",
      "args": ["/path/to/porymap-mcp/mcp-server/dist/index.js"]
    }
  }
}
```

### Cursor/Windsurf Configuration

Add to your `.cursor/mcp.json` or `.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "porymap": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

## Tools Reference

### Project Management

| Tool | Description |
|------|-------------|
| `open_project` | Open a Pokemon decompilation project directory |
| `close_project` | Close the currently open project |
| `get_project_info` | Get information about the open project |
| `list_maps` | List all maps, optionally filtered by group |
| `list_constants` | List constant values (species, items, flags, etc.) |
| `list_tilesets` | List available tilesets |

### Map Reading

| Tool | Description |
|------|-------------|
| `get_map_header` | Get map header properties (music, weather, type, flags) |
| `get_map_blocks` | Read block data (metatile IDs, collision, elevation) |
| `get_map_border` | Read border block data |
| `get_map_events` | Get all events on a map, filtered by type |
| `get_map_connections` | Get all connections for a map |

### Map Writing

| Tool | Description |
|------|-------------|
| `set_map_header` | Update map header fields |
| `set_blocks` | Set blocks at specific positions |
| `fill_region` | Fill a rectangular region with a metatile |
| `resize_map` | Resize a map layout |
| `shift_map` | Shift all map blocks by an offset |
| `set_border` | Set border blocks |

### Event Management

| Tool | Description |
|------|-------------|
| `add_event` | Add a new event to a map |
| `update_event` | Update an existing event |
| `remove_event` | Remove an event from a map |
| `move_event` | Move an event to new coordinates |

### Connections

| Tool | Description |
|------|-------------|
| `add_connection` | Add a connection to another map |
| `update_connection` | Update connection properties |
| `remove_connection` | Remove a connection |

### Encounters

| Tool | Description |
|------|-------------|
| `get_encounters` | Get wild encounter data for a map |
| `set_encounters` | Set wild encounter data for a map |
| `add_encounter_slot` | Add an encounter slot to a map |
| `remove_encounter_slot` | Remove an encounter slot |

### Tilesets

| Tool | Description |
|------|-------------|
| `get_tileset_info` | Get tileset properties |
| `set_tileset_metatiles` | Set metatile attributes for a tileset |

### Search

| Tool | Description |
|------|-------------|
| `search_by_metatile_behavior` | Find maps using a metatile behavior |
| `search_by_event` | Find maps with specific events |
| `search_by_flag` | Find maps using a specific flag |

### Heal Locations

| Tool | Description |
|------|-------------|
| `list_heal_locations` | List all heal locations |
| `get_heal_location` | Get details of a heal location |
| `add_heal_location` | Add a new heal location |
| `update_heal_location` | Update a heal location |
| `remove_heal_location` | Remove a heal location |

### Map Management

| Tool | Description |
|------|-------------|
| `create_map` | Create a new map |
| `delete_map` | Delete a map |
| `copy_map` | Copy a map to a new location |

## Examples

### Opening a Project

```
Tool: open_project
Argument: { "project_path": "/path/to/pokeemerald" }
```

### Listing Maps in a Group

```
Tool: list_maps
Argument: { "group": "Dungeon" }
```

### Getting Map Events

```
Tool: get_map_events
Argument: { "map": "PetalburgWoods" }
```

### Updating Map Header

```
Tool: set_map_header
Argument: {
  "map": "PetalburgWoods",
  "weather": "RAIN",
  "map_type": "MAP_TYPE_INDOOR"
}
```

### Adding a Warp

```
Tool: add_event
Argument: {
  "map": "PetalburgCity",
  "event_type": "warp",
  "x": 10,
  "y": 12,
  "warp_id": 0,
  "destination": "PlayerHouse2F",
  "dest_warp_id": 1
}
```

### Finding Maps with Surf

```
Tool: search_by_metatile_behavior
Argument: { "behavior": "MB_WATER" }
```

## Project Structure

```
mcp-server/
├── src/
│   ├── index.ts          # Server entry point
│   ├── project.ts        # Project context management
│   ├── types.ts          # Type definitions
│   ├── utils.ts          # Utility functions
│   ├── data/             # Data parsing modules
│   │   ├── map-json.ts
│   │   ├── layouts.ts
│   │   ├── constants.ts
│   │   └── ...
│   └── tools/            # MCP tool implementations
│       ├── project-tools.ts
│       ├── map-read-tools.ts
│       ├── map-write-tools.ts
│       └── ...
├── dist/                 # Compiled output
└── package.json
```

## License

Same as Porymap (GPL-3.0)
