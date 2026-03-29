# 🐞 ForgeRunner Bug Fix Review Task

**Task ID**: `BUG-001_ForgeRunner_QA_Fixes`
**Target Service**: `ForgeRunner` (Playwright-BDD Adapter & MCP Bridge)
**Status**: `READY_FOR_REVIEW`

Following the QA Vulnerability Report generated in `forgerunner_qa_review.md`, the following critical issues and gaps have been resolved:

## Fixed Issues

### 1. 🛑 Command Injection & Shell Escaping (P1)
- **Problem**: `npx playwright test --grep "${escapedGreps.join('|')}"` was vulnerable to string injection and did not properly escape paths.
- **Solution**: 
  - Introduced `sanitizeShellArg()` to properly evaluate `process.platform` and apply correct escaping (using `""` for Windows `cmd.exe` and standard backslash escaping for Unix bash).
  - Explicitly sanitized the Playwright config path (`configPath`) before appending.
  - Properly passed the escaped `args` avoiding simple concatenation injection pitfalls.

### 2. ⚠️ Hardcoded `npx` Environment Assumption (P2)
- **Problem**: Extension blindly assumed `npx bddgen` and `npx playwright test` global resolution.
- **Solution**: 
  - Created `getPackageManagerPrefix(executionDir)` which scans for `yarn.lock`, `pnpm-lock.yaml`, or `bun.lockb` files to determine the accurate package manager command (`npx`, `yarn`, `pnpm exec`, `bunx`).
  - Swapped hardcoded `npx` prefix with dynamic parameter substitution in execution commands.

### 3. ⚠️ Brittle MCP Server Auto-Discovery (P2)
- **Problem**: The `resolveMcpTransport()` function matched any valid path containing the term "TestForge", causing silent crashes if it evaluated a configuration flag like `--workspace=TestForge` instead of a `.js` executable.
- **Solution**:
  - Restructured matching rule to explicitly require `fs.statSync(arg).isFile()` and `arg.endsWith('.js')` inside the `claude_desktop_config.json` args looping.

### 4. 🚧 Debug Sessions Dropping Test Results (P3)
- **Problem**: VS Code Test Explorer statuses weren't updated post debug execution due to missing JSON artifact exports.
- **Solution**:
  - Injected `PLAYWRIGHT_JSON_OUTPUT_NAME` into the `vscode.DebugConfiguration.env` targeting `os.tmpdir()`.
  - Added robust parsing of `forge-debug-results` post-session execution directly inside `onDidTerminateDebugSession`.
  - Fallback logic appended to emit `errored` states for uncaptured outcomes.

### 5. 🚧 Orphaned Temp Files (P3)
- **Problem**: `.json` result artifacts bloated `os.tmpdir()` upon critical execution errors in `try/catch`.
- **Solution**:
  - Relocated strict `fs.unlinkSync(jsonOutputFile)` cleanup into robust `finally` blocks universally across `runTests` and `debugTests` lifecycles.

## Verification Checklist
- [x] Tested with `yarn`, `pnpm`, `npm` fallback executions
- [x] Syntax escaping applied for Windows environments
- [x] Test adapter hooks correctly track result transitions during debug scenarios
- [x] Verified auto-discovery ignores non-executable files

Please review the source modifications across `src/adapters/playwrightBddAdapter.ts` and `src/services/mcpBridge.ts`.
