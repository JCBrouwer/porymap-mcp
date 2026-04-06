import * as path from "node:path";
import type { Layout, LayoutsJson, Block, PositionedBlock } from "../types.js";
import {
  readJsonFile,
  writeJsonFile,
  readBlockdata,
  writeBlockdata,
  McpError,
  ensureDir,
} from "../utils.js";

export function readLayouts(filepath: string): LayoutsJson {
  return readJsonFile<LayoutsJson>(filepath);
}

export function writeLayouts(filepath: string, data: LayoutsJson): void {
  writeJsonFile(filepath, data);
}

export function findLayout(
  data: LayoutsJson,
  layoutId: string,
): Layout | undefined {
  return data.layouts.find((l) => l.id === layoutId || l.name === layoutId);
}

export function getLayoutForMap(
  layoutsData: LayoutsJson,
  layoutId: string,
): Layout {
  const layout = findLayout(layoutsData, layoutId);
  if (!layout) {
    throw new McpError("LAYOUT_NOT_FOUND", `Layout '${layoutId}' not found`);
  }
  return layout;
}

// Read map blockdata as a 2D grid of positioned blocks
export function readMapBlocks(
  projectRoot: string,
  layout: Layout,
): PositionedBlock[] {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const blocks = readBlockdata(blockdataPath);
  const positioned: PositionedBlock[] = [];

  for (let y = 0; y < layout.height; y++) {
    for (let x = 0; x < layout.width; x++) {
      const idx = y * layout.width + x;
      if (idx < blocks.length) {
        positioned.push({ x, y, ...blocks[idx] });
      }
    }
  }
  return positioned;
}

// Read a rectangular region of blocks
export function readMapBlockRegion(
  projectRoot: string,
  layout: Layout,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): PositionedBlock[] {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const blocks = readBlockdata(blockdataPath);
  const positioned: PositionedBlock[] = [];

  for (let y = ry; y < ry + rh && y < layout.height; y++) {
    for (let x = rx; x < rx + rw && x < layout.width; x++) {
      const idx = y * layout.width + x;
      if (idx < blocks.length) {
        positioned.push({ x, y, ...blocks[idx] });
      }
    }
  }
  return positioned;
}

// Read border blocks
export function readBorderBlocks(
  projectRoot: string,
  layout: Layout,
): PositionedBlock[] {
  const borderPath = path.resolve(projectRoot, layout.border_filepath);
  const blocks = readBlockdata(borderPath);
  const bw = layout.border_width ?? 2;
  const bh = layout.border_height ?? 2;
  const positioned: PositionedBlock[] = [];

  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const idx = y * bw + x;
      if (idx < blocks.length) {
        positioned.push({ x, y, ...blocks[idx] });
      }
    }
  }
  return positioned;
}

// Write specific blocks to the blockdata file
export function setMapBlocks(
  projectRoot: string,
  layout: Layout,
  updates: PositionedBlock[],
): number {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const blocks = readBlockdata(blockdataPath);
  let count = 0;

  for (const update of updates) {
    if (update.x < 0 || update.x >= layout.width || update.y < 0 || update.y >= layout.height) {
      throw new McpError(
        "INVALID_COORDINATES",
        `Coordinates (${update.x}, ${update.y}) out of bounds for layout ${layout.width}x${layout.height}`,
      );
    }
    const idx = update.y * layout.width + update.x;
    blocks[idx] = {
      metatileId: update.metatileId,
      collision: update.collision,
      elevation: update.elevation,
    };
    count++;
  }

  writeBlockdata(blockdataPath, blocks);
  return count;
}

// Fill a rectangular region with a single block value
export function fillMapBlocks(
  projectRoot: string,
  layout: Layout,
  x: number,
  y: number,
  width: number,
  height: number,
  metatileId: number,
  collision: number,
  elevation: number,
): number {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const blocks = readBlockdata(blockdataPath);
  let count = 0;

  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const bx = x + dx;
      const by = y + dy;
      if (bx >= 0 && bx < layout.width && by >= 0 && by < layout.height) {
        const idx = by * layout.width + bx;
        blocks[idx] = { metatileId, collision, elevation };
        count++;
      }
    }
  }

  writeBlockdata(blockdataPath, blocks);
  return count;
}

// Resize a layout's blockdata
export function resizeLayout(
  projectRoot: string,
  layout: Layout,
  newWidth: number,
  newHeight: number,
  fillMetatileId: number = 0,
  fillCollision: number = 0,
  fillElevation: number = 3,
): void {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const oldBlocks = readBlockdata(blockdataPath);
  const oldWidth = layout.width;
  const oldHeight = layout.height;

  const newBlocks: Block[] = [];
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      if (x < oldWidth && y < oldHeight) {
        newBlocks.push(oldBlocks[y * oldWidth + x]);
      } else {
        newBlocks.push({
          metatileId: fillMetatileId,
          collision: fillCollision,
          elevation: fillElevation,
        });
      }
    }
  }

  writeBlockdata(blockdataPath, newBlocks);
}

// Shift all blocks by a delta
export function shiftMapBlocks(
  projectRoot: string,
  layout: Layout,
  xDelta: number,
  yDelta: number,
  fillMetatileId: number = 0,
  fillCollision: number = 0,
  fillElevation: number = 3,
): void {
  const blockdataPath = path.resolve(projectRoot, layout.blockdata_filepath);
  const oldBlocks = readBlockdata(blockdataPath);
  const w = layout.width;
  const h = layout.height;

  const newBlocks: Block[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcX = x - xDelta;
      const srcY = y - yDelta;
      if (srcX >= 0 && srcX < w && srcY >= 0 && srcY < h) {
        newBlocks.push(oldBlocks[srcY * w + srcX]);
      } else {
        newBlocks.push({
          metatileId: fillMetatileId,
          collision: fillCollision,
          elevation: fillElevation,
        });
      }
    }
  }

  writeBlockdata(blockdataPath, newBlocks);
}

// Write border blocks
export function setBorderBlocks(
  projectRoot: string,
  layout: Layout,
  updates: PositionedBlock[],
): void {
  const borderPath = path.resolve(projectRoot, layout.border_filepath);
  const bw = layout.border_width ?? 2;
  const bh = layout.border_height ?? 2;
  const blocks = readBlockdata(borderPath);

  for (const update of updates) {
    if (update.x < 0 || update.x >= bw || update.y < 0 || update.y >= bh) {
      throw new McpError(
        "INVALID_COORDINATES",
        `Border coordinates (${update.x}, ${update.y}) out of bounds for border ${bw}x${bh}`,
      );
    }
    const idx = update.y * bw + update.x;
    blocks[idx] = {
      metatileId: update.metatileId,
      collision: update.collision,
      elevation: update.elevation,
    };
  }

  writeBlockdata(borderPath, blocks);
}

// Create new blockdata files for a new layout
export function createBlockdata(
  projectRoot: string,
  layout: Layout,
  fillMetatileId: number = 0,
  borderMetatileId: number = 0,
): void {
  const blockdataDir = path.dirname(
    path.resolve(projectRoot, layout.blockdata_filepath),
  );
  ensureDir(blockdataDir);

  // Create map.bin
  const mapBlocks: Block[] = [];
  for (let i = 0; i < layout.width * layout.height; i++) {
    mapBlocks.push({ metatileId: fillMetatileId, collision: 0, elevation: 3 });
  }
  writeBlockdata(
    path.resolve(projectRoot, layout.blockdata_filepath),
    mapBlocks,
  );

  // Create border.bin
  const bw = layout.border_width ?? 2;
  const bh = layout.border_height ?? 2;
  const borderBlocks: Block[] = [];
  for (let i = 0; i < bw * bh; i++) {
    borderBlocks.push({
      metatileId: borderMetatileId,
      collision: 0,
      elevation: 0,
    });
  }
  writeBlockdata(
    path.resolve(projectRoot, layout.border_filepath),
    borderBlocks,
  );
}

// Add a new layout to layouts.json
export function addLayout(data: LayoutsJson, layout: Layout): void {
  data.layouts.push(layout);
}
