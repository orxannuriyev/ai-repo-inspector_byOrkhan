import { describe, expect, it } from "vitest";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { createInspectorMcpServer } from "../src/mcp-server.js";

describe("MCP Server Integration", () => {
  async function setupClientServer() {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createInspectorMcpServer();
    await server.connect(serverTransport);

    const client = new Client({
      name: "test-mcp-client",
      version: "1.0.0",
    });
    await client.connect(clientTransport);

    return { client, server };
  }

  it("exposes the review_repository tool with proper schema", async () => {
    const { client } = await setupClientServer();
    const tools = await client.listTools();
    const reviewTool = tools.tools.find((t) => t.name === "review_repository");

    expect(reviewTool).toBeDefined();
    expect(reviewTool?.inputSchema.properties).toHaveProperty("repo_path");
    expect(reviewTool?.inputSchema.properties).toHaveProperty("base_ref");
    expect(reviewTool?.inputSchema.properties).toHaveProperty("format");
    await client.close();
  });

  it("executes review_repository tool successfully with json format", async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: "review_repository",
      arguments: {
        repo_path: process.cwd(),
        format: "json",
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toBeTruthy();
    const parsed = JSON.parse(content[0]?.text ?? "{}");
    expect(parsed.repositoryPath).toBe(process.cwd());
    await client.close();
  });

  it("returns isError: true when given an invalid repository path", async () => {
    const { client } = await setupClientServer();
    const result = await client.callTool({
      name: "review_repository",
      arguments: {
        repo_path: "./nonexistent-mcp-dir-xyz-999",
      },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("Error: Repository path does not exist");
    await client.close();
  });
});
