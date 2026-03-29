# 🕵️ ForgeRunner QA Review & Vulnerability Report

**Date**: 2026-03-30
**Scope**: `ForgeRunner` VS Code Extension (Focus: MCP limits, BDD test execution, Process spawning)
**Reviewer**: AppForge/TestForge QA Automation (Shrewd Quality Engineer)

---

## 🛑 Critical Issues (P1)

### 1. Command Injection & Improper Shell Escaping
**Severity**: High | **Priority**: P1
**Location**: `src/adapters/playwrightBddAdapter.ts` -> `getRunArgs` & `runTests`
**Description**: 
The adapter constructs shell commands by concatenating strings and executing them via `child_process.exec()` (via `execAsync`). 
- **The Flaw**: It uses `.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` to escape Regex characters for Playwright's `--grep`, but fails to properly sanitize or shell-escape the string. It blindly wraps the joined greps in double-quotes (`"${escapedGreps.join('|')}"`). If a scenario name contains double quotes, backticks, or shell metacharacters (`$(...)`), it leads to arbitrary command injection or crashes the test run entirely.
- **Path Escaping**: `configPath` (used in `--config=${configPath}`) is not wrapped in quotes. If the user's workspace path contains spaces (e.g., `C:\My Projects\repo\playwright.config.ts`), the command `npx playwright test --config=C:\My Projects...` will fail syntax parsing in the shell.

---

## ⚠️ Major Gaps & Flaws (P2)

### 2. Hardcoded `npx` Environment Assumption
**Severity**: Medium | **Priority**: P2
**Location**: `src/adapters/playwrightBddAdapter.ts` -> `runTests` & `debugTests`
**Description**:
The runner explicitly hardcodes `await execAsync('npx bddgen', ...)` and `npx playwright test`. 
- **The Gap**: In modern Enterprise environments using strict `yarn`, `pnpm`, or `bun` workspaces, `npx` might either be unavailable, resolve to a global cache instead of the local workspace, or fail due to missing lockfiles. The extension must implement package-manager detection (like TestForge does) to ensure execution compatibility.

### 3. Brittle MCP Server Auto-Discovery
**Severity**: Medium | **Priority**: P2
**Location**: `src/services/mcpBridge.ts` -> `resolveMcpTransport()`
**Description**:
The MCP bridge attempts to reverse-engineer Claude's configuration by parsing `claude_desktop_config.json`.
- **The Flaw**: It iterates over `server.args` and incorrectly assumes *any* argument containing the substring `'TestForge'` that also exists on the filesystem is the actual executable path to run via Node (`return { command: 'node', args: [arg] }`). If an argument is a flag (e.g., `--workspace=C:\TestForge`), Node will attempt to execute the folder/flag and crash the MCP bridge silently.
- **The Fallback**: The fallback executes `npx -y testforge`. If the package isn't published or the user is offline, it hangs or crashes.

---

## 🚧 Functional Bugs & Leaks (P3)

### 4. Debug Sessions Drop Test Results
**Severity**: Medium | **Priority**: P3
**Location**: `src/adapters/playwrightBddAdapter.ts` -> `debugTests`
**Description**:
When triggering a debug run via the VS Code Testing UI, the `debugTests()` method successfully launches the debugger but fails to hook into the test results.
- **The Bug**: Unlike `runTests()`, which parses `PLAYWRIGHT_JSON_OUTPUT_NAME`, `debugTests()` only listens for the debugger to terminate (`onDidTerminateDebugSession`) and then calls `run.end()`. It never parses pass/fail states. The VS Code Test Explorer will incorrectly show the test as just "finished" (or leaves it in an indeterminate state) instead of marking it green/red.

### 5. Orphaned JSON Temp Files (Resource Leak)
**Severity**: Low | **Priority**: P3
**Location**: `src/adapters/playwrightBddAdapter.ts` -> `runTests`
**Description**:
The extension writes playwright results to a temp file (`path.join(os.tmpdir(), 'forge-results-...json')`).
- **The Bug**: The cleanup `fs.unlinkSync(jsonOutputFile)` is located inside a nested `try` block *after* the parsing logic. If `execAsync` throws a critical error, or if `JSON.parse()` fails due to malformed output, the temp file is never deleted. Over time, heavy test usage will bloat the OS temporary directory with hundreds of orphaned JSON files.
