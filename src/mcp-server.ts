#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

export function createInspectorMcpServer(): McpServer {
  const server = new McpServer({
    name: "repository-inspector",
    version: "2.0.0",
  });

  server.tool(
    "review_repository",
    "Inspects a Git repository and returns a review report. " +
      "Returns a list of changed files (vs. the base branch) and their statuses.",
    {
      repo_path: z
        .string()
        .describe("Absolute path to the Git repository to inspect."),
      base_ref: z
        .string()
        .optional()
        .describe(
          "Base Git ref to diff against. Auto-detected from origin HEAD if omitted.",
        ),
      format: z
        .enum(["markdown", "json"])
        .optional()
        .describe("Output format (default: markdown)."),
    },
    async (input) => {
      try {
        const report = await reviewRepository({
          repositoryPath: input.repo_path,
          baseRef: input.base_ref,
          format: input.format,
        });
        return { content: [{ type: "text" as const, text: report }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

function isCurrentScriptExecuted(): boolean {
  try {
    if (!process.argv[1]) return false;
    const currentFile = fileURLToPath(import.meta.url);
    const invokedFile = resolve(process.argv[1]);
    if (currentFile === invokedFile) return true;
    return realpathSync(currentFile) === realpathSync(invokedFile);
  } catch {
    return false;
  }
}

if (isCurrentScriptExecuted()) {
  const server = createInspectorMcpServer();
  await server.connect(new StdioServerTransport());
}
