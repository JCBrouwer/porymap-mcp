/**
 * Integration tests for connection operations, including mirror logic.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProjectContext } from "../../src/project.js";
import {
  addConnection,
  updateConnection,
  removeConnection,
  reverseDirection,
  writeMapJson,
  getConnections,
} from "../../src/data/map-json.js";
import { createTestProject, MAP_PETALBURG, MAP_ROUTE101 } from "../helpers.js";
import type { TestProject } from "../helpers.js";

let tp: TestProject;
let project: ProjectContext;

beforeEach(() => {
  tp = createTestProject();
  project = new ProjectContext(tp.root);
});

afterEach(() => {
  tp.cleanup();
});

describe("add_connection", () => {
  it("adds a connection and persists it", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addConnection(mapData, { map: "MAP_ROUTE101", direction: "down", offset: 5 });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    const connections = getConnections(reread);
    expect(connections).toHaveLength(1);
    expect(connections[0].direction).toBe("down");
    expect(connections[0].offset).toBe(5);
  });

  it("mirror logic adds reverse connection on target map", () => {
    const petalburgData = project.readMapJson(MAP_PETALBURG);
    const route101Data = project.readMapJson(MAP_ROUTE101);

    // Simulate mirror: add down connection on petalburg, add up on route101
    addConnection(petalburgData, { map: "MAP_ROUTE101", direction: "down", offset: 3 });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), petalburgData);

    addConnection(route101Data, { map: petalburgData.id, direction: "up", offset: -3 });
    writeMapJson(project.getMapJsonPath(MAP_ROUTE101), route101Data);

    const rereadRoute = project.readMapJson(MAP_ROUTE101);
    const routeConns = getConnections(rereadRoute);
    expect(routeConns).toHaveLength(1);
    expect(routeConns[0].direction).toBe("up");
  });

  it("mirror warning scenario: reverseDirection works for all cardinals", () => {
    expect(reverseDirection("up")).toBe("down");
    expect(reverseDirection("down")).toBe("up");
    expect(reverseDirection("left")).toBe("right");
    expect(reverseDirection("right")).toBe("left");
    expect(reverseDirection("dive")).toBe("emerge");
    expect(reverseDirection("emerge")).toBe("dive");
  });
});

describe("update_connection", () => {
  it("updates a connection by index", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addConnection(mapData, { map: "MAP_ROUTE101", direction: "down", offset: 0 });
    updateConnection(mapData, 0, { offset: 10 });
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    expect(getConnections(reread)[0].offset).toBe(10);
  });

  it("throws for invalid index", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    expect(() => updateConnection(mapData, 5, { offset: 1 })).toThrow();
  });
});

describe("remove_connection", () => {
  it("removes connection by index", () => {
    const mapData = project.readMapJson(MAP_PETALBURG);
    addConnection(mapData, { map: "MAP_ROUTE101", direction: "down", offset: 0 });
    addConnection(mapData, { map: "MAP_ROUTE102", direction: "left", offset: 0 });
    removeConnection(mapData, 0);
    writeMapJson(project.getMapJsonPath(MAP_PETALBURG), mapData);

    const reread = project.readMapJson(MAP_PETALBURG);
    const conns = getConnections(reread);
    expect(conns).toHaveLength(1);
    expect(conns[0].map).toBe("MAP_ROUTE102");
  });
});
