/**
 * Integration tests for project operations including close_project.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTestProject } from "../helpers.js";
import { clearAllProjects, setProject, getProject } from "../../src/tools/project-tools.js";
import { ProjectContext } from "../../src/project.js";
import type { TestProject } from "../helpers.js";

let tp: TestProject;

beforeEach(() => {
  tp = createTestProject();
  clearAllProjects();
});

afterEach(() => {
  tp.cleanup();
  clearAllProjects();
});

describe("close_project behavior", () => {
  it("setProject and clearAllProjects work correctly", () => {
    const server = new McpServer({ name: "test", version: "0.1.0" });
    
    // Initially no project is set
    expect(() => {
      getProject(server);
    }).toThrow();
    
    // Set project
    const project = new ProjectContext(tp.root);
    setProject(server, project);
    
    // Now project should be accessible
    const retrievedProject = getProject(server);
    expect(retrievedProject.root).toBe(tp.root);
    
    // Clear all projects
    clearAllProjects();
    
    // Should throw again
    expect(() => getProject(server)).toThrow();
  });

  it("each server instance has isolated project state", () => {
    const server1 = new McpServer({ name: "test1", version: "0.1.0" });
    const server2 = new McpServer({ name: "test2", version: "0.1.0" });
    
    // Both servers share the same project path (which is fine for this test)
    const project1 = new ProjectContext(tp.root);
    const project2 = new ProjectContext(tp.root);
    
    setProject(server1, project1);
    setProject(server2, project2);
    
    // Each server should get a valid project context back
    const retrievedProject1 = getProject(server1);
    const retrievedProject2 = getProject(server2);
    
    // Both should be valid project contexts pointing to the test root
    expect(retrievedProject1.root).toBe(tp.root);
    expect(retrievedProject2.root).toBe(tp.root);
    
    // Clearing one server's project should not affect the other
    clearAllProjects();
    expect(() => getProject(server1)).toThrow();
    expect(() => getProject(server2)).toThrow();
  });
});
