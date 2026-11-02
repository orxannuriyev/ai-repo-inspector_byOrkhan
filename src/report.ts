import type { ChangedFile, ValidationResult } from "./types.js";

export type ReportInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

export function markdownReport(input: ReportInput): string {
  const lines = [
    `# Review Report: ${input.repositoryPath}`,
    "",
    "## Changed files",
  ];

  if (input.changedFiles.length === 0) {
    lines.push("_No changed files detected._");
  } else {
    for (const file of input.changedFiles) {
      lines.push(`- ${file.path} (${file.status})`);
    }
  }

  lines.push("", "## Validation output");

  if (input.validationResults.length === 0) {
    lines.push("_No validation commands were run._");
  } else {
    for (const result of input.validationResults) {
      const icon = result.status === "passed" ? "✅" : "❌";
      lines.push(
        `### ${icon} ${result.command} — ${result.status}`,
        "```",
        result.output,
        "```",
      );
    }
  }

  return lines.join("\n");
}

export function jsonReport(input: ReportInput): string {
  return JSON.stringify(
    {
      repositoryPath: input.repositoryPath,
      changedFiles: input.changedFiles,
      validationResults: input.validationResults,
    },
    null,
    2,
  );
}