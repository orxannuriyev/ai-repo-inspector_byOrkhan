import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviewRepository } from "../src/core.js";

describe("reviewRepository", () => {
  it("throws when repository path does not exist", async () => {
    await expect(
      reviewRepository({
        repositoryPath: "./nonexistent-directory-abc-123",
      }),
    ).rejects.toThrow("Repository path does not exist");
  });

  it("throws when path exists but is not a git repository", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "non-git-repo-"));
    try {
      await expect(
        reviewRepository({
          repositoryPath: tempDir,
        }),
      ).rejects.toThrow("Not a git repository");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("produces a valid markdown report for the current repository", async () => {
    const report = await reviewRepository({
      repositoryPath: process.cwd(),
      format: "markdown",
    });
    expect(report).toContain("# Review Report:");
    expect(report).toContain("## Changed files");
    expect(report).toContain("## Validation output");
  });

  it("produces a valid JSON report when format is json", async () => {
    const report = await reviewRepository({
      repositoryPath: process.cwd(),
      format: "json",
    });
    const parsed = JSON.parse(report);
    expect(parsed).toHaveProperty("repositoryPath");
    expect(parsed).toHaveProperty("changedFiles");
    expect(Array.isArray(parsed.changedFiles)).toBe(true);
    expect(parsed).toHaveProperty("validationResults");
    expect(Array.isArray(parsed.validationResults)).toBe(true);
  });
});
