#!/usr/bin/env node
import { realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewRepository } from "./core.js";

export type Args = {
  command: string;
  repositoryPath?: string;
  baseRef?: string;
  format?: "markdown" | "json";
  validations: string[];
};

export function parseArgs(argv: string[]): Args {
  const args: Args = { command: argv[0] ?? "", validations: [] };
  for (let index = 1; index < argv.length; index++) {
    const token = argv[index];
    if (token === "--repo") {
      args.repositoryPath = argv[++index];
    } else if (token === "--base-ref") {
      args.baseRef = argv[++index];
    } else if (token === "--format") {
      const formatVal = argv[++index];
      if (formatVal === "markdown" || formatVal === "json") {
        args.format = formatVal;
      }
    } else if (token === "--validate") {
      const value = argv[++index];
      if (value !== undefined) {
        args.validations.push(value);
      }
    }
  }
  return args;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.command !== "review" || !args.repositoryPath) {
    console.error(
      "Usage: inspector review --repo <path> [--base-ref <ref>] [--format markdown|json] [--validate <command>]",
    );
    return 1;
  }

  const report = await reviewRepository({
    repositoryPath: args.repositoryPath,
    baseRef: args.baseRef,
    validationCommands: args.validations,
    format: args.format,
  });

  const outputFile =
    args.format === "json" ? "review-report.json" : "review-report.md";
  writeFileSync(outputFile, report, "utf8");
  console.log(`Review report written to ${outputFile}`);
  return 0;
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

async function main() {
  const exitCode = await runCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

if (isCurrentScriptExecuted()) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exitCode = 1;
  });
}
