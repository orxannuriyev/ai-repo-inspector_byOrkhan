import { execFileSync } from "node:child_process";
import type { ChangedFile } from "./types.js";

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    timeout: 10_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * Detects the default branch of the repository by checking the remote HEAD,
 * then falling back to well-known branch names or the current branch.
 */
function detectDefaultBranch(repositoryPath: string): string {
  try {
    const ref = git(repositoryPath, [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]).trim();
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    // Check common branch names
    for (const candidate of ["main", "master"]) {
      try {
        git(repositoryPath, ["rev-parse", "--verify", candidate]);
        return candidate;
      } catch {
        continue;
      }
    }
    // Check current branch if available
    try {
      const current = git(repositoryPath, [
        "branch",
        "--show-current",
      ]).trim();
      if (current) return current;
    } catch {
      // Fallback
    }
    return "main";
  }
}

export function changedFiles(
  repositoryPath: string,
  baseRef?: string,
): ChangedFile[] {
  const filesMap = new Map<string, ChangedFile>();

  // 1. Branch diff against base
  const base = baseRef ?? detectDefaultBranch(repositoryPath);
  try {
    const diffOutput = git(repositoryPath, [
      "diff",
      "--name-status",
      `${base}...HEAD`,
    ]);

    if (diffOutput) {
      for (const rawLine of diffOutput.split("\n")) {
        const line = rawLine.replace(/\r$/, "");
        if (!line.trim()) continue;

        const parts = line.split("\t");
        const code = parts[0] ?? "";

        let status: ChangedFile["status"];
        let filePath: string;

        if (code.startsWith("R")) {
          status = "renamed";
          filePath = parts[2] ?? parts[1] ?? "";
        } else if (code.startsWith("C")) {
          status = "copied";
          filePath = parts[2] ?? parts[1] ?? "";
        } else if (code === "A") {
          status = "added";
          filePath = parts[1] ?? "";
        } else if (code === "D") {
          status = "deleted";
          filePath = parts[1] ?? "";
        } else {
          status = "modified";
          filePath = parts[1] ?? "";
        }

        if (filePath) {
          filesMap.set(filePath, { path: filePath, status });
        }
      }
    }
  } catch {
    // If diff against base fails (e.g. empty repo or base not found),
    // proceed to check local status.
  }

  // 2. Working tree status (including staged, unstaged, and untracked changes)
  try {
    const statusOutput = git(repositoryPath, ["status", "--porcelain", "-u"]);
    if (statusOutput) {
      for (const rawLine of statusOutput.split("\n")) {
        const line = rawLine.replace(/\r$/, "");
        if (!line.trim()) continue;

        const statusCode = line.slice(0, 2);
        let rawPath = line.slice(3).trim();

        if (rawPath.startsWith('"') && rawPath.endsWith('"')) {
          rawPath = rawPath.slice(1, -1);
        }

        let status: ChangedFile["status"];
        let filePath = rawPath;

        if (statusCode.includes("R")) {
          status = "renamed";
          const arrowIndex = rawPath.indexOf("->");
          if (arrowIndex !== -1) {
            filePath = rawPath.slice(arrowIndex + 2).trim();
          }
        } else if (statusCode === "??") {
          status = "untracked";
        } else if (statusCode.includes("A")) {
          status = "added";
        } else if (statusCode.includes("D")) {
          status = "deleted";
        } else {
          status = "modified";
        }

        if (filePath) {
          filesMap.set(filePath, { path: filePath, status });
        }
      }
    }
  } catch {
    // Graceful fallback if status fails
  }

  return Array.from(filesMap.values());
}
