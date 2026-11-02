import { describe, expect, it, vi } from "vitest";
import { parseArgs, runCli } from "../src/cli.js";

describe("parseArgs", () => {
  it("parses review command with --repo", () => {
    const args = parseArgs(["review", "--repo", "/path/to/repo"]);
    expect(args.command).toBe("review");
    expect(args.repositoryPath).toBe("/path/to/repo");
  });

  it("preserves paths that contain spaces", () => {
    const args = parseArgs(["review", "--repo", "/path/with spaces/repo"]);
    expect(args.repositoryPath).toBe("/path/with spaces/repo");
  });

  it("parses --base-ref flag", () => {
    const args = parseArgs([
      "review",
      "--repo",
      ".",
      "--base-ref",
      "develop",
    ]);
    expect(args.baseRef).toBe("develop");
  });

  it("parses --format flag", () => {
    const args = parseArgs(["review", "--repo", ".", "--format", "json"]);
    expect(args.format).toBe("json");
  });

  it("parses multiple --validate flags", () => {
    const args = parseArgs([
      "review",
      "--repo",
      ".",
      "--validate",
      "npm test",
      "--validate",
      "npm run lint",
    ]);
    expect(args.validations).toEqual(["npm test", "npm run lint"]);
  });

  it("ignores --validate at end of argv with no value", () => {
    const args = parseArgs(["review", "--repo", ".", "--validate"]);
    expect(args.validations).toEqual([]);
  });

  it("defaults to empty command when argv is empty", () => {
    const args = parseArgs([]);
    expect(args.command).toBe("");
    expect(args.validations).toEqual([]);
  });
});

describe("runCli", () => {
  it("returns exit code 1 when required arguments are missing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const code = await runCli([]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
