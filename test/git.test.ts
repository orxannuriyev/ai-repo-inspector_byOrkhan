import { describe, expect, it } from "vitest";
import { changedFiles } from "../src/git.js";

describe("git.ts changedFiles", () => {
  it("returns an array of changed files for the current repository", () => {
    const files = changedFiles(process.cwd());
    expect(Array.isArray(files)).toBe(true);
    for (const file of files) {
      expect(file).toHaveProperty("path");
      expect(file).toHaveProperty("status");
      expect([
        "added",
        "modified",
        "deleted",
        "renamed",
        "copied",
        "untracked",
      ]).toContain(file.status);
    }
  });

  it("handles non-existent base branch without throwing fatal error", () => {
    expect(() => {
      changedFiles(process.cwd(), "non-existent-base-ref-12345");
    }).not.toThrow();
  });
});
