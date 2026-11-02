import { exec } from "node:child_process";
import type { ValidationResult } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

/**
 * Runs a single validation command using shell execution with strict timeout,
 * output buffering, and error containment.
 *
 * Failed commands resolve with status: "failed" and their output/error message
 * rather than rejecting the promise, preventing process crashes.
 *
 * Security Note:
 * This tool executes validation commands provided by the CLI user in their local
 * environment (where they already possess full shell access). For untrusted
 * contexts like MCP agents, validation execution is deliberately prohibited at the
 * interface level (hybrid trust model) rather than relying on brittle whitespace splitting.
 */
export function runValidation(
  command: string,
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ValidationResult> {
  const trimmed = command.trim();
  if (!trimmed) {
    return Promise.resolve({
      command,
      status: "failed",
      output: "Empty command",
    });
  }

  return new Promise((resolve) => {
    exec(
      trimmed,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            command,
            status: "failed",
            output: stderr?.trim() || stdout?.trim() || error.message,
          });
          return;
        }
        resolve({
          command,
          status: "passed",
          output: stdout?.trim() || stderr?.trim() || "Passed with no output",
        });
      },
    );
  });
}

export async function runValidations(
  commands: string[],
  cwd: string,
): Promise<ValidationResult[]> {
  return Promise.all(commands.map((cmd) => runValidation(cmd, cwd)));
}
