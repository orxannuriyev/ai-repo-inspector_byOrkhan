import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { changedFiles } from "./git.js";
import { jsonReport, markdownReport } from "./report.js";
import type { ReviewRequest } from "./types.js";
import { runValidations } from "./validation.js";

function isGitRepository(dir: string): boolean {
  if (existsSync(resolve(dir, ".git"))) {
    return true;
  }
  try {
    const output = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output === "true";
  } catch {
    return false;
  }
}

export async function reviewRepository(
  request: ReviewRequest,
): Promise<string> {
  const repoPath = resolve(request.repositoryPath);

  if (!existsSync(repoPath) || !statSync(repoPath).isDirectory()) {
    throw new Error(
      `Repository path does not exist or is not a directory: ${repoPath}`,
    );
  }

  if (!isGitRepository(repoPath)) {
    throw new Error(`Not a git repository: ${repoPath}`);
  }

  const files = changedFiles(repoPath, request.baseRef);
  const validations = await runValidations(
    request.validationCommands ?? [],
    repoPath,
  );

  const reportInput = {
    repositoryPath: repoPath,
    changedFiles: files,
    validationResults: validations,
  };

  if (request.format === "json") {
    return jsonReport(reportInput);
  }
  return markdownReport(reportInput);
}
