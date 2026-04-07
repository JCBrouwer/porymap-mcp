import * as fs from "node:fs";
import * as path from "node:path";
import type { Block } from "./types.js";

// Default bit masks matching porymap's defaults
const METATILE_ID_MASK = 0x3ff;
const COLLISION_SHIFT = 10;
const COLLISION_MASK = 0x3;
const ELEVATION_SHIFT = 12;
const ELEVATION_MASK = 0xf;

export function decodeBlock(raw: number): Block {
  return {
    metatileId: raw & METATILE_ID_MASK,
    collision: (raw >> COLLISION_SHIFT) & COLLISION_MASK,
    elevation: (raw >> ELEVATION_SHIFT) & ELEVATION_MASK,
  };
}

export function encodeBlock(
  metatileId: number,
  collision: number,
  elevation: number,
): number {
  return (
    (metatileId & METATILE_ID_MASK) |
    ((collision & COLLISION_MASK) << COLLISION_SHIFT) |
    ((elevation & ELEVATION_MASK) << ELEVATION_SHIFT)
  );
}

export function readBlockdata(filepath: string): Block[] {
  const buf = fs.readFileSync(filepath);
  const blocks: Block[] = [];
  for (let i = 0; i < buf.length; i += 2) {
    blocks.push(decodeBlock(buf.readUInt16LE(i)));
  }
  return blocks;
}

export function writeBlockdata(filepath: string, blocks: Block[]): void {
  const buf = Buffer.alloc(blocks.length * 2);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    buf.writeUInt16LE(encodeBlock(b.metatileId, b.collision, b.elevation), i * 2);
  }
  // Write atomically via temp file
  const tmp = filepath + ".tmp";
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, filepath);
}

export function readJsonFile<T>(filepath: string): T {
  const content = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(content) as T;
}

export function writeJsonFile(filepath: string, data: unknown): void {
  const content = JSON.stringify(data, null, 4) + "\n";
  const tmp = filepath + ".tmp";
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filepath);
}

export function fileExists(filepath: string): boolean {
  try {
    fs.accessSync(filepath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function ensureDir(dirpath: string): void {
  fs.mkdirSync(dirpath, { recursive: true });
}

export function resolveProjectPath(
  projectRoot: string,
  relativePath: string,
): string {
  return path.resolve(projectRoot, relativePath);
}

// Convert a map name like "PetalburgCity" to constant "MAP_PETALBURG_CITY"
export function mapNameToConstant(name: string): string {
  // Insert underscore before uppercase letters, then uppercase the whole thing
  const snaked = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
  return `MAP_${snaked}`;
}

// Convert a layout name like "PetalburgCity" to constant "LAYOUT_PETALBURG_CITY"
export function layoutNameToConstant(name: string): string {
  const snaked = name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
  return `LAYOUT_${snaked}`;
}

export class McpError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}
