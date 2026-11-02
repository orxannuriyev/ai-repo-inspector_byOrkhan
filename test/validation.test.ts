import { describe, expect, it } from "vitest";
import { runValidation, runValidations } from "../src/validation.js";

describe("runValidation", () => {
  it("returns passed for a successful command", async () => {
    const result = await runValidation("echo hello", process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output).toContain("hello");
  });

  it("returns failed for a command that exits non-zero", async () => {
    const result = await runValidation(
      "node -e process.exit(1)",
      process.cwd(),
    );
    expect(result.status).toBe("failed");
  });

  it("returns failed for a nonexistent command", async () => {
    const result = await runValidation(
      "nonexistent_command_xyz_123",
      process.cwd(),
    );
    expect(result.status).toBe("failed");
    expect(result.output).toBeTruthy();
  });

  it("returns failed for an empty command", async () => {
    const result = await runValidation("", process.cwd());
    expect(result.status).toBe("failed");
    expect(result.output).toContain("Empty command");
  });

  it("supports chained commands and quotes in shell execution", async () => {
    const result = await runValidation(
      'echo "first" && echo "second"',
      process.cwd(),
    );
    expect(result.status).toBe("passed");
    expect(result.output).toContain("first");
    expect(result.output).toContain("second");
  });

  it("respects timeout", async () => {
    const result = await runValidation(
      "node -e 'setTimeout(() => {}, 2000)'",
      process.cwd(),
      300,
    );
    expect(result.status).toBe("failed");
  }, 10_000);
});

describe("runValidations", () => {
  it("runs multiple commands and returns all results", async () => {
    const results = await runValidations(
      ["echo first", "echo second"],
      process.cwd(),
    );
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("passed");
    expect(results[1].status).toBe("passed");
  });

  it("returns empty array for no commands", async () => {
    const results = await runValidations([], process.cwd());
    expect(results).toHaveLength(0);
  });

  it("captures both passed and failed results", async () => {
    const results = await runValidations(
      ["echo ok", "node -e process.exit(1)"],
      process.cwd(),
    );
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("passed");
    expect(results[1].status).toBe("failed");
  });
});
