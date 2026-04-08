/**
 * MCP Test Infrastructure
 * 
 * Provides utilities for testing MCP tool handlers directly.
 * This allows testing tool handlers without needing the full MCP transport layer.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { setProject, clearAllProjects } from "../src/tools/project-tools.js";
import { ProjectContext } from "../src/project.js";

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export interface TestContext {
  server: McpServer;
  project: ProjectContext;
}

/**
 * Create a mock MCP server with project tools registered and project set up.
 */
export function createTestServer(projectRoot: string): TestContext {
  const server = new McpServer({
    name: "test-server",
    version: "0.1.0",
  });

  const project = new ProjectContext(projectRoot);
  setProject(server, project);

  return { server, project };
}

/**
 * Clear all project state between tests.
 */
export function clearState(): void {
  clearAllProjects();
}

/**
 * Helper to extract JSON from tool result.
 */
export function getResultJson<T>(result: McpToolResult): T {
  if (result.isError) {
    throw new Error(`Tool returned error: ${result.content[0]?.text}`);
  }
  const text = result.content[0]?.text;
  if (!text) {
    throw new Error("No content in result");
  }
  return JSON.parse(text) as T;
}

/**
 * Helper to check if result is an error.
 */
export function isError(result: McpToolResult): boolean {
  return result.isError === true;
}

/**
 * Helper to get error message from result.
 */
export function getErrorMessage(result: McpToolResult): string {
  if (!result.isError) {
    throw new Error("Result is not an error");
  }
  return result.content[0]?.text ?? "";
}
