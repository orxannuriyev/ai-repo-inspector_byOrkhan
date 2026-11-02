# Submission

## What did you investigate first, and why?

I started by reading every source file to build a complete mental model of the system's data flow:
`cli.ts` / `mcp-server.ts` → `core.ts` → `git.ts` + `validation.ts` → `report.ts`. I then audited the codebase for contract consistency, packaging validity, trust boundaries, error resilience, and edge-case behavior.

The first concrete bugs I identified were:
1. **MCP schema mismatch**: `repo_path` (snake_case) in the Zod schema vs `input.repoPath` (camelCase) in the callback, combined with an untyped `any` parameter that masked the defect and rendered the MCP tool completely non-functional.
2. **Packaging failure**: `package.json` declared `"bin": { "inspector": "./dist/cli.js" }`, but `tsconfig.json` compiles TypeScript files into `./dist/src/cli.js`. Running the package binary directly failed immediately with `MODULE_NOT_FOUND`.
3. **Validation process crash**: `validation.ts` threw on command failures (`reject(error)`), causing the entire process to abort instead of gracefully capturing a failed validation result.

## What did you choose to implement or fix?

**Packaging & Runtime Safety:**
- Fixed `package.json` binary path to point to `./dist/src/cli.js`.
- Guarded `main()` execution in `src/cli.ts` using entrypoint inspection so importing CLI helpers (e.g., in unit tests) does not trigger top-level execution, spurious `Usage` stderr logs, or process exit codes.
- Added clean CLI error handling in `runCli` to present user-friendly error messages (`Error: <message>`) instead of leaking raw Node.js stack traces when input paths are invalid.
- Added `vitest.config.ts` excluding `dist/**` and `node_modules/**` so running `npm test` after `npm run build` executes cleanly without duplicate execution of compiled `.js` files.

**Core & Architecture:**
- Validated repository paths in `src/core.ts` (ensuring existence, directory type, and verifying git worktree status via `.git` or `git rev-parse`).
- Implemented `format: "json"` end-to-end across `report.ts`, `core.ts`, `cli.ts`, and `mcp-server.ts`.
- Structured MCP error returns with `{ isError: true, content: [...] }` per the Model Context Protocol specification.

**Git Inspection Robustness:**
- Handled `R` (renamed) and `C` (copied) status codes from `git diff --name-status`.
- Added default branch auto-detection (querying `refs/remotes/origin/HEAD`, fallbacks to `main`/`master`, and active branch resolution).
- Expanded git change detection to inspect both committed branch differences (`git diff ${base}...HEAD`) and uncommitted/untracked working tree modifications (`git status --porcelain -u`). Restored `"untracked"` status in `src/types.ts`.
- Fixed whitespace slicing in git status parsing so filenames with leading space indicators (such as ` M SUBMISSION.md`) retain their correct paths.

**Validation Runner (DX & Trust Boundary):**
- Preserved shell execution for CLI validations to support essential developer workflows: command chaining (`npm run typecheck && npm test`), quoted arguments (`git commit -m "..."`), and environment variable flags.
- Added timeouts (default 60s) and large output buffers (10MB) to prevent command hangs and buffer overflows.
- Made validations resolve gracefully on non-zero exit codes with `status: "failed"` and captured error output.

**Comprehensive Test Suite:**
- Scaled from 1 initial test to 36 tests across 6 dedicated test suites:
  - `test/cli.test.ts`: Flag parsing, whitespace path preservation, missing-arg exit codes, clean error reporting without stack traces.
  - `test/core.test.ts`: Directory validation, git repository verification, error branch testing (non-existent and non-git directories), markdown and JSON report pipelines.
  - `test/git.test.ts`: Git status parsing, fallback branch handling, change extraction.
  - `test/mcp.test.ts`: Full in-memory client/server integration test verifying tool registration, parameter schemas, successful JSON generation, and error containment.
  - `test/report.test.ts`: Empty-state placeholders, pass/fail status icons, multi-file reporting, JSON generation.
  - `test/validation.test.ts`: Success, failure, timeout handling, empty commands, and chained shell expressions.

## What did you intentionally not do?

- **Did not expose validation commands in the MCP interface.** Allowing arbitrary command execution via an AI agent's tool call introduces a severe prompt-injection and remote-execution risk. The CLI user already possesses shell permissions in their local terminal, but an AI agent operating via MCP should operate under reduced privilege.
- **Did not attempt a bespoke AST shell parser.** Rather than using naive whitespace splitting that breaks developer commands, or writing a custom shell lexer, standard shell execution with execution timeouts and error interception was used for CLI, while untrusted execution is prohibited in MCP.
- **Did not require external git network access.** Git inspection and branch detection rely strictly on local repository metadata without performing network fetches that could hang in offline or restricted environments.

## Interface decision

- Decision: **Hybrid** (CLI-first with full capabilities; MCP as a secure, read-only inspection companion)
- Primary user and execution environment: Developers operating in their local terminal (CLI), and AI coding assistants inspecting workspace state inside editor environments like VS Code or Claude Desktop (MCP).
- Trust boundary and allowed capabilities: 
  - **CLI (Full Trust)**: The local developer controls the execution environment. They can specify any repository path and run arbitrary validation commands (`--validate "npm test"`).
  - **MCP (Restricted Trust)**: The AI agent can inspect repository diffs and output reports, but cannot trigger shell commands. This eliminates prompt-injection attacks that attempt to run destructive commands via tool execution.
- Reliability, discoverability, latency/context, and output tradeoffs: 
  - CLI writes persistent reports to disk (`review-report.md` or `review-report.json`), ideal for large diffs and CI/CD pipelines.
  - MCP returns inline responses directly within tool calls, supporting both Markdown and JSON for programmatic AI parsing without exceeding context limits.
- How supported interfaces remain consistent: Both adapters invoke the same `reviewRepository` engine in `core.ts`. Git inspection, validation execution logic, and report formatting are completely unified.
- Evidence that would change this decision: If target repositories adopt a committed safe-command manifest (e.g. `.inspector.json` or pre-approved npm test scripts), pre-approved validations could be safely exposed to MCP clients under an allow-list model.

## How did you use an AI coding agent?

I used an AI assistant as a collaborative pair-programmer to explore edge cases, draft initial test templates, and stress-test assumptions across the TypeScript implementation. Every AI output was critically reviewed against the actual runtime behavior, type definitions, and protocol standards.

## Where did you check, correct, or reject an AI suggestion? (required)

1. **Rejected naive `execFile()` whitespace-splitting for validation:**
   The AI initially suggested replacing `exec()` with `execFile()` and splitting commands with `command.trim().split(/\s+/)` under the rationale of preventing shell injection. I **rejected** this implementation: in the CLI interface, the developer is already running inside their own shell. Splitting on whitespace broke common, legitimate commands such as chained scripts (`npm run typecheck && npm test`), arguments with quotes (`git commit -m "initial commit"`), and environment variables. Instead, I enforced security at the interface boundary: allowing standard shell execution with timeout/error containment for the trusted CLI, while omitting `validationCommands` entirely from the untrusted MCP tool.

2. **Corrected `package.json` binary target:**
   The AI did not notice that `tsconfig.json` compiled output to `./dist/src/cli.js`, leaving the starter's `"bin": { "inspector": "./dist/cli.js" }` pointing to a non-existent file. I corrected the manifest path to `./dist/src/cli.js`.

3. **Corrected Vitest build-output duplication:**
   The AI reported "23 tests passing" prior to running `npm run build`. Once compiled, Vitest picked up both `.ts` sources and `.js` build artifacts in `dist/`, running 46 tests and logging stderr messages. I corrected this by creating `vitest.config.ts` with explicit exclusions for `dist/**`.

4. **Added true MCP integration testing:**
   While the AI noted that MCP had not been integration-tested, its proposed test suite omitted MCP entirely. I implemented `test/mcp.test.ts` using `@modelcontextprotocol/sdk/inMemory.js` to verify real client-server tool listing, execution, and error handling.

## Commands used to verify the result, with outcomes

```bash
$ npm run typecheck
# tsc -p tsconfig.json --noEmit → Exit code 0 (0 errors)

$ npm run build
# tsc -p tsconfig.json → Exit code 0 (clean compilation into dist/)

$ npm test
# vitest run → Exit code 0 (6 test files passed, 36/36 tests passed)

$ node ./dist/src/cli.js review --repo . --format json
# Successfully verified compiled binary execution and output generation

$ npm run inspector -- review --repo . --validate "echo 'testing shell'"
# Exit code 0, generated review-report.md with change list and validation output
```

## A blocker you hit and how you approached it

When integrating `git status --porcelain` to detect uncommitted changes, a subtle bug emerged where `SUBMISSION.md` was rendered as `UBMISSION.md`. Investigation revealed that a helper function applied `.trim()` to the entire multi-line git output, stripping the leading space of line 0 (`" M SUBMISSION.md"` became `"M SUBMISSION.md"`), which offset fixed-width index slicing. Removing the global string trim and normalizing lines individually resolved the bug cleanly.

## Known limitations and the next three things you would do

1. **Allow-list execution for MCP**: Add support for an optional `.inspector.json` file in target repositories allowing AI agents to invoke pre-approved, safe validation commands.
2. **Interactive terminal progress / streaming**: For lengthy validation suites, stream command stdout/stderr incrementally rather than buffering until completion.
3. **Structured git diff stats**: Extend `ChangedFile` to include lines added, lines deleted, and original paths for renamed files to enrich report detail.

## Approximate focused-work time

- Start: 18:45
- Finish: 19:40
