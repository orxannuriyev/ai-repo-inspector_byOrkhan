import { describe, expect, it } from "vitest";
import { markdownReport, jsonReport } from "../src/report.js";

describe("markdownReport", () => {
  it("lists changed files and validation output", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok" },
      ],
    });

    expect(report).toContain("src/index.ts (modified)");
    expect(report).toContain("npm test");
    expect(report).toContain("ok");
  });

  it("shows placeholder when no files changed", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [],
    });
    expect(report).toContain("No changed files detected");
  });

  it("shows placeholder when no validations were run", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "a.ts", status: "added" }],
      validationResults: [],
    });
    expect(report).toContain("No validation commands were run");
  });

  it("marks failed validations with ❌", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "failed", output: "1 test failed" },
      ],
    });
    expect(report).toContain("❌");
    expect(report).toContain("failed");
  });

  it("marks passed validations with ✅", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "passed", output: "all passed" },
      ],
    });
    expect(report).toContain("✅");
    expect(report).toContain("passed");
  });

  it("handles multiple changed files", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [
        { path: "a.ts", status: "added" },
        { path: "b.ts", status: "deleted" },
        { path: "c.ts", status: "modified" },
      ],
      validationResults: [],
    });
    expect(report).toContain("a.ts (added)");
    expect(report).toContain("b.ts (deleted)");
    expect(report).toContain("c.ts (modified)");
  });

  it("renders untracked files correctly in report", () => {
    const report = markdownReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "new-file.ts", status: "untracked" }],
      validationResults: [],
    });
    expect(report).toContain("new-file.ts (untracked)");
  });
});

describe("jsonReport", () => {
  it("returns valid JSON with all fields", () => {
    const report = jsonReport({
      repositoryPath: "/work/sample",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok" },
      ],
    });
    const parsed = JSON.parse(report);
    expect(parsed.repositoryPath).toBe("/work/sample");
    expect(parsed.changedFiles).toHaveLength(1);
    expect(parsed.changedFiles[0].path).toBe("src/index.ts");
    expect(parsed.validationResults).toHaveLength(1);
    expect(parsed.validationResults[0].status).toBe("passed");
  });

  it("returns valid JSON with empty arrays", () => {
    const report = jsonReport({
      repositoryPath: "/work/sample",
      changedFiles: [],
      validationResults: [],
    });
    const parsed = JSON.parse(report);
    expect(parsed.changedFiles).toHaveLength(0);
    expect(parsed.validationResults).toHaveLength(0);
  });
});