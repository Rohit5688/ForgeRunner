# 🗺️ ForgeRunner · TestForge · AppForge — Implementation Plan

**Based on**: `BUG-001_ForgeRunner_QA_Fixes.md`, `BUG-016_Playwright_Import_Strategy.md`, `feature_gap_analysis.md`, `qa_progress_walkthrough.md`, `code_review_report.md`  
**Date**: 2026-03-30  
**Owner**: Forge QA Engineering

---

## 📐 How to Read This Plan

- **Priority**: P1 = Fix immediately (security/crash). P2 = Fix before next release. P3 = Fix in current sprint. P4 = Roadmap.
- **Status key**: 🔴 Open · 🟠 In Progress · ✅ Done · 📋 Planned

Items are grouped by **project**, then sorted by priority within each group.

---

## 🔴 Section 1: Bug Backlog (All Three Projects)

### BUG-001 · ForgeRunner · P1 — Command Injection & Shell Escaping
| Field | Value |
|:---|:---|
| **ID** | BUG-001 |
| **Project** | ForgeRunner |
| **Priority** | P1 — Security Critical |
| **Status** | ✅ Done |
| **File** | `src/adapters/playwrightBddAdapter.ts` → `getRunArgs()`, `runTests()` |
| **Description** | `--grep` pattern was built from scenario names with only regex-special-char escaping. If names contained shell metacharacters (`"`, `` ` ``, `$()`), arbitrary command injection was possible. `configPath` was concatenated without quotes — paths with spaces caused parse failures. |
| **Fix Applied** | `sanitizeShellArg()` wraps all args in platform-correct quoting (Windows `""`, Unix `\`). `configPath` is now always passed through `sanitizeShellArg()`. |
| **Verified By** | `forgerunner_qa_review.md` issue #1 |

---

### BUG-002 · ForgeRunner · P2 — Hardcoded `npx` Environment Assumption
| Field | Value |
|:---|:---|
| **ID** | BUG-002 |
| **Project** | ForgeRunner |
| **Priority** | P2 — Compatibility |
| **Status** | ✅ Done |
| **File** | `src/adapters/playwrightBddAdapter.ts` → `runTests()`, `debugTests()` |
| **Description** | Extension assumed `npx` is always available. In `yarn`/`pnpm`/`bun` workspaces, `npx` resolves from the global cache instead of the local workspace, causing version mismatches or failures. |
| **Fix Applied** | `getPackageManagerPrefix(executionDir)` detects `yarn.lock` / `pnpm-lock.yaml` / `bun.lockb` and returns the correct prefix (`yarn`, `pnpm exec`, `bunx`, or `npx` as fallback). |
| **Verified By** | `forgerunner_qa_review.md` issue #2 |

---

### BUG-003 · ForgeRunner · P2 — Brittle MCP Server Auto-Discovery
| Field | Value |
|:---|:---|
| **ID** | BUG-003 |
| **Project** | ForgeRunner |
| **Priority** | P2 — Reliability |
| **Status** | ✅ Done |
| **File** | `src/services/mcpBridge.ts` → `resolveMcpTransport()` |
| **Description** | The discovery loop matched any arg containing the substring `"TestForge"` that existed on the filesystem. A workspace flag like `--workspace=C:\TestForge` would pass the `fs.existsSync()` check (if the folder existed) and be passed to `node` as an executable path, causing a silent crash. |
| **Fix Applied** | Added compound guard: `arg.includes('TestForge') && fs.existsSync(arg) && fs.statSync(arg).isFile() && arg.endsWith('.js')`. All four conditions must be true before the arg is used as a node executable. |
| **Verified By** | `forgerunner_qa_review.md` issue #3 |

---

### BUG-004 · ForgeRunner · P3 — Debug Sessions Drop Test Results
| Field | Value |
|:---|:---|
| **ID** | BUG-004 |
| **Project** | ForgeRunner |
| **Priority** | P3 — Functional |
| **Status** | ✅ Done |
| **File** | `src/adapters/playwrightBddAdapter.ts` → `debugTests()` |
| **Description** | `debugTests()` launched the debugger but never parsed test results. VS Code Test Explorer showed tests as "finished" without green/red status because `PLAYWRIGHT_JSON_OUTPUT_NAME` was not injected and the JSON file was never read. |
| **Fix Applied** | Injected `PLAYWRIGHT_JSON_OUTPUT_NAME` into `DebugConfiguration.env`. Added JSON result parsing inside `onDidTerminateDebugSession` handler, with fallback to emit `errored` states for uncaptured outcomes. |
| **Verified By** | `forgerunner_qa_review.md` issue #4 |

---

### BUG-005 · ForgeRunner · P3 — Orphaned Temp Files on Critical Errors
| Field | Value |
|:---|:---|
| **ID** | BUG-005 |
| **Project** | ForgeRunner |
| **Priority** | P3 — Resource Leak |
| **Status** | ✅ Done |
| **File** | `src/adapters/playwrightBddAdapter.ts` → `runTests()` |
| **Description** | `fs.unlinkSync(jsonOutputFile)` was inside a nested try block after JSON parsing. If `execAsync` threw a critical error earlier, cleanup was skipped, bloating `os.tmpdir()` with orphaned result files over time. |
| **Fix Applied** | Moved `fs.unlinkSync` into a `finally` block that always runs, regardless of the execution path. |
| **Verified By** | `forgerunner_qa_review.md` issue #5 |

---

### BUG-006 · ForgeRunner · P1 — Shell Injection in `showTrace` Command ⚠️ NEW
| Field | Value |
|:---|:---|
| **ID** | BUG-006 |
| **Project** | ForgeRunner |
| **Priority** | P1 — Security Critical |
| **Status** | ✅ Done (fixed in code review session) |
| **File** | `src/extension.ts` → `forge-runner.showTrace` command handler (line 193) |
| **Description** | The `showTrace` command accepted a file path from the OS file-open dialog and directly interpolated it into `terminal.sendText()`: `npx playwright show-trace "${uri[0].fsPath}"`. A crafted path containing embedded double-quotes or backticks (`"`, `` ` ``) could escape the string and inject arbitrary shell commands into the VS Code integrated terminal. This is the same vulnerability class as BUG-001, missed because it's outside the adapter layer. |
| **Root Cause** | `sanitizeShellArg()` was defined as a `private` method inside `PlaywrightBddAdapter` and was not accessible from `extension.ts`. No equivalent helper existed at the extension level. |
| **Fix Applied** | Added module-level `escapeForTerminal(filePath: string): string` in `extension.ts` that wraps the path in double-quotes and escapes embedded quotes using the Windows `""` pattern (safe on all terminal types VS Code supports). Applied to both `showTrace` and `showReport` path construction. |
| **Test Case** | Open VS Code on a project in a path containing `"My "Project"`. Click "Show Trace" and select any `.zip` file. Verify the terminal runs `npx playwright show-trace "..."` with correctly escaped path, not broken shell. |

---

### BUG-007 · ForgeRunner · P3 — `debugTests` Missing Outer `finally` Block ⚠️ NEW
| Field | Value |
|:---|:---|
| **ID** | BUG-007 |
| **Project** | ForgeRunner |
| **Priority** | P3 — Resource Leak / Consistency |
| **Status** | ✅ Done (fixed in code review session) |
| **File** | `src/adapters/playwrightBddAdapter.ts` → `debugTests()` (lines 220–320) |
| **Description** | BUG-005's fix required `finally` blocks "universally" across `runTests` AND `debugTests`. `runTests` was correctly updated. `debugTests` was partially updated — cleanup was split between the `catch` block and the `onDidTerminateDebugSession` handler, with no outer `finally`. If `startDebugging()` threw synchronously (e.g., VS Code debugger not available), `run.end()` was only called from `catch`, and temp-file cleanup was inconsistent. |
| **Root Cause** | Incomplete application of the BUG-005 pattern. `debugTests` has a more complex lifecycle (the run is handed off to the debug session event handler) which complicated the initially applied fix. |
| **Fix Applied** | Added `sessionStarted: boolean` flag. Refactored to a proper outer `try/finally`. The `finally` block only calls `run.end()` and cleans the temp file if `sessionStarted === false`, preventing a double-`run.end()` race with the session handler. |
| **Test Case** | Force `vscode.debug.startDebugging()` to return `false` (mock). Verify `run.end()` is called exactly once and `os.tmpdir()` contains no orphaned `forge-debug-results-*.json`. |

---

### BUG-008 · TestForge · P2 — `FixtureDataService` Output Format Mismatch ⚠️ NEW
| Field | Value |
|:---|:---|
| **ID** | BUG-008 |
| **Project** | TestForge |
| **Priority** | P2 — Silent Tool-Chain Break |
| **Status** | ✅ Done (fixed in code review session) |
| **File** | `src/services/FixtureDataService.ts` → `generateFixturePrompt()` (line 42) |
| **Description** | The fixture prompt instructed the LLM to return "ONLY the raw TypeScript code block." Every other generator in TestForge (`TestGenerationService`, `SeleniumMigrationService`) instructs the LLM to return a structured JSON object matching `{ files: [{ path, content }] }` — the schema that `validate_and_write` parses. When the LLM followed the fixture prompt, `validate_and_write` received a raw `.ts` string and silently failed to write any files. Users saw no error, no fixture file was created. |
| **Root Cause** | The fixture service was built before the `validate_and_write` schema was standardized. The instruction was never updated when the rest of the generation pipeline adopted the JSON-first approach. |
| **Fix Applied** | Updated Rule 4 in the fixture prompt to instruct the LLM to return a single valid JSON object with the `files[]` array, including a concrete example schema and a note to correctly escape template literals inside the content string. |
| **Test Case** | Call `generate_fixture` for entity `"User"`. Verify the LLM returns `{ "files": [{ "path": "fixtures/user.fixture.ts", "content": "..." }] }`. Call `validate_and_write` with the result. Verify `fixtures/user.fixture.ts` is created on disk and compiles without TypeScript errors. |

---

### BUG-016 · TestForge · P2 — Playwright Import Strategy
| Field | Value |
|:---|:---|
| **ID** | BUG-016 |
| **Project** | TestForge |
| **Priority** | P2 — DX / Correctness |
| **Status** | ✅ Done |
| **Files** | `ProjectSetupService.ts`, `TestGenerationService.ts`, `FixtureDataService.ts`, `ProjectMaintenanceService.ts`, `EnvironmentCheckService.ts` |
| **Description** | All generated code and AI prompts were instructing imports from `playwright-bdd` for APIs (`test`, `expect`, `Page`) that belong to `@playwright/test`. Standard Playwright APIs must be imported from `@playwright/test`, which is provided implicitly by `playwright-bdd` and should NOT be added to `package.json`. Having both explicit caused "describe() unexpectedly called" errors. |
| **Fix Applied** | All 6 components updated: templates import from `@playwright/test`; AI prompt rules mandate the same; health check warns when `@playwright/test` is found explicitly in devDependencies. |
| **Verified By** | `BUG-016_Playwright_Import_Strategy.md` — all 6 checkboxes confirmed. |

---

### GAP-001 · TestForge · Low — `checkBrowsersDownloaded` May False-Warn
| Field | Value |
|:---|:---|
| **ID** | GAP-001 |
| **Project** | TestForge |
| **Priority** | Low — Documentation |
| **Status** | 📋 Documented, No Fix Required Now |
| **File** | `src/services/EnvironmentCheckService.ts:156` |
| **Description** | Local browser detection checks `node_modules/playwright/.local-browsers`. When browsers are installed globally in `~/.cache/ms-playwright`, this path doesn't exist, producing a spurious `warn` status even when browsers are correctly available. The existing `PLAYWRIGHT_BROWSERS_PATH` env check and `npx playwright --version` fallback partially mitigate this. |
| **Suggested Fix** | Add a third check: `path.join(os.homedir(), '.cache', 'ms-playwright')` (cross-platform: `%LOCALAPPDATA%\ms-playwright` on Windows). Promote to a proper P3 fix if users start reporting false "browsers not found" warnings after `npm install`. |

---

## 📋 Section 2: Feature Roadmap (ForgeRunner v1 → v2)

Priority order follows the MCP-integration architecture recommended in `feature_gap_analysis.md`.  
These are **new features**, not bugs. They will be tracked as separate feature tickets.

---

### FEAT-001 · P2 — AI-Powered Editor Context Menus (Right-Click on `.feature` files)

**What v1 had**: Hardcoded commands — `Format Feature File`, `Generate Step Definitions`, `Extract Scenario Outline`, `Validate Feature Structure`, `Validate Step Coverage`.  
**Why v1's approach is wrong for v2**: Hardcoded generators produce generic output with no project context.

**v2 Plan (MCP-Enhanced)**:
- Register a `vscode.languages.registerCodeLensProvider` for `**/*.feature`.
- Right-click context menu items trigger MCP tools:
  - **"✨ Generate Steps"** → calls `generate_gherkin_pom_test_suite` with the full feature file content + existing codebase analysis as context.
  - **"🔍 Validate Coverage"** → calls `analyze_coverage` on the specific feature file.
  - **"🧹 Format File"** → calls `FormattingProvider` (already registered in v2).
  - **"♻️ Extract Outline"** → new prompt that detects repeated scenario patterns and rewrites them as a `Scenario Outline`.
- The AI output is presented in the ForgeAI Sidebar, not auto-written to disk, giving the engineer a review step.

**Files to Create/Modify**:
- `src/providers/featureContextMenuProvider.ts` (new)
- `src/extension.ts` → register the new provider + commands
- `package.json` → add `contributes.menus["editor/context"]` entries

---

### FEAT-002 · P3 — Test Explorer Tag Filter & History UI

**What v1 had**: Toolbar buttons — `Filter by Tag`, `Filter by Status`, `Clear Filters`, `Show Test Execution History`.  
**What v2 has**: Tag filtering works via `--grep`, but there is no UI control for it and no history view.

**v2 Plan**:
- Add tag filter input to the Test Explorer title bar using `vscode.window.createQuickPick()`.
- Store the last 20 test run outcomes (per scenario ID) in `TestStateStore` (already exists).
- Wire a `forge-runner.showTestHistory` command to a webview that renders the stored run history with pass/fail trend sparklines.
- The existing `TestStateStore.recordSuccess()` / `recordFailure()` already captures per-item history — this feature just needs a UI layer.

**Files to Create/Modify**:
- `src/ui/testHistoryView.ts` (new)
- `src/core/testStateStore.ts` → add `getHistory(itemId)` method
- `src/extension.ts` → register `forge-runner.showTestHistory` command

---

### FEAT-003 · P4 — CI/CD Analysis Dashboard

**What v1 had**: GitHub Workflow status screen, trigger workflow, view remote playwright HTML reports.  
**Why this is better with MCP**: The LLM can read CI failure logs and explain the root cause in plain English.

**v2 Plan**:
- Add a `forge-runner.analyzeCIFailure` command.
- The command prompts the user for a GitHub Actions run URL (or reads it from `mcp-config.json`).
- Calls `self_heal_test` MCP tool with the CI failure output as `testOutput`.
- Renders the AI explanation in the ForgeAI Sidebar with action buttons: "Apply Fix" / "Open Trace".
- Future: use GitHub REST API (with a PAT stored in VS Code's `SecretStorage`) to auto-fetch the latest failed run log.

**Files to Create/Modify**:
- `src/services/ciAnalysisService.ts` (new)
- `src/ui/aiSidebar.ts` → add "Analyze CI Failure" message type
- `package.json` → add `forge-runner.analyzeCIFailure` command contribution

---

### FEAT-004 · P4 — Native BDD Debugger (Step-by-Step + Breakpoints) [DEFERRED]

**What v1 had**: `Start Step-by-Step Debugging`, `Toggle BDD Breakpoint`, `Set Conditional Breakpoint`.  
**Why this is hard**: Requires a custom Debug Adapter Protocol (DAP) shim between VS Code and Playwright's inspector to map compiled `.spec.js` lines back to `.feature` lines.

**What is NOT Implemented (Compared to Original)**:
- We did **not** implement setting visual breakpoints on `.feature` lines in the VS Code editor.
- We did **not** implement a custom DAP for step-by-step execution.
- We did **not** implement code lenses injecting `page.pause()` dynamically.

**What is Implemented Instead**:
- We rely on the existing `debugTests()` runner logic. Clicking the "Debug" icon in the Test Explorer sets the `PWDEBUG=1` environment variable and launches the native Playwright Inspector. This provides a safe, out-of-the-box debugging experience without brittle code injection or complex DAP mappings.

---

### FEAT-005 · P4 — Multi-Workspace UI

**What v1 had**: `Show Workspaces`, `Switch Active Workspace`, `Search Across Workspaces`, `Create Workspace Group`.  
**What v2 has architecturally**: `AutoDiscoveryService` already scans workspace folders. The data is there.

**v2 Plan**:
- Add a VS Code `TreeDataProvider` in the Activity Bar sidebar that lists all discovered workspaces with their MCP connection status.
- Each workspace node shows children: last test run result, MCP status, configured framework.
- `Switch Active Workspace` → updates `forge-runner.playwright.projectRoot` setting for the selected workspace.
- `Search Across Workspaces` → runs `analyze_codebase` via MCP for each workspace and aggregates step definitions into a unified search panel.

**Files to Create/Modify**:
- `src/ui/workspaceExplorer.ts` (new)
- `src/core/autoDiscovery.ts` → expose workspace list
- `package.json` → add `contributes.views` for workspace explorer

---

### FEAT-006 · P5 — Unified Project Kickstart (CLI)

**The Gap**: Onboarding is disjointed. Users have to configure MCPs, IDE settings, and test dependencies piece by piece.
**v2 Plan**: Create a single `create-forge-app` CLI that:
- Prompts for "Web vs Mobile"
- Scaffolds Playwright/Appium boilerplate
- Auto-generates `mcp-config.json` and `.vscode/settings.json`
- Pulls in the correct test framework automatically.

---

### FEAT-007 · P5 — Test Data Management (State Reset Automation)

**The Gap**: Mock data is handled (Faker), but enterprise QA databases need API or SQL state-reset logic before scenarios run.
**v2 Plan**: 
- Introduce a new MCP service that can parse backend integration schemas.
- The AI generates `beforeEach` handlers to hit internal REST APIs or SQL scripts to reset test-user states automatically.

---

### FEAT-008 · P5 — Cloud Device Grid Integration

**The Gap**: Execution is limited to local simulators/containers. Scaling requires Enterprise execution environments.
**v2 Plan**: 
- Add capability into `EnvironmentCheckService` to validate tokens for SauceLabs, BrowserStack, or LambdaTest.
- Allow users to push their auto-generated configuration via command payload directly to a cloud farm.

---

### FEAT-009 · P4 — Team-Wide Analytics Dashboard

**The Gap**: Teams lack visibility into how frequently the AI is "healing" tests, or what cross-project flakiness exists over time.
**v2 Plan**: 
- Spin off an enterprise reporter that captures telemetry from AI healing events over time, outputting a web dashboard. The manager can see exactly which components cost the most token usage or generated the most UI churn.

---

### FEAT-010 · P5 — Native CI/CD Actions Marketplace Connectors

**The Gap**: Manually parsing CI failures is good, but hands-free CI is better.
**v2 Plan**: Create a pre-packaged GitHub Action (`uses: forge-automation/self-heal-action@v1`) that runs purely in headless CI, capturing trace output without requiring VS Code to intercept and fix a bug on failure.

---

## 📊 Section 3: Work Summary

### Bug Tracker

| ID | Project | Priority | Title | Status |
|:---|:---|:---|:---|:---|
| BUG-001 | ForgeRunner | P1 | Command Injection & Shell Escaping | ✅ Done |
| BUG-002 | ForgeRunner | P2 | Hardcoded `npx` Assumption | ✅ Done |
| BUG-003 | ForgeRunner | P2 | Brittle MCP Auto-Discovery | ✅ Done |
| BUG-004 | ForgeRunner | P3 | Debug Sessions Drop Results | ✅ Done |
| BUG-005 | ForgeRunner | P3 | Orphaned Temp Files (`runTests`) | ✅ Done |
| **BUG-006** | **ForgeRunner** | **P1** | **Shell Injection in `showTrace`** | ✅ Done |
| **BUG-007** | **ForgeRunner** | **P3** | **`debugTests` Missing `finally` Block** | ✅ Done |
| **BUG-008** | **TestForge** | **P2** | **`FixtureDataService` Output Mismatch** | ✅ Done |
| BUG-016 | TestForge | P2 | Playwright Import Strategy | ✅ Done |
| GAP-001 | TestForge | Low | `checkBrowsersDownloaded` False-Warn | 📋 Documented |

> [!NOTE]
> **BUG-006, BUG-007, BUG-008** are newly identified — not present in the original QA vulnerability report. They were found during the cross-project code review session.

### Feature Roadmap

| ID | Priority | Title | Phase |
|:---|:---|:---|:---|
| FEAT-001 | P2 | AI-Powered Editor Context Menus | ✅ Done |
| FEAT-002 | P3 | Test Explorer Tag Filter & History UI | ✅ Done |
| FEAT-003 | P4 | CI/CD Analysis Dashboard | ✅ Done |
| FEAT-004 | P4 | Native BDD Debugger (Step-by-Step) | ➡️ Deferred — existing `debugTests` + `PWDEBUG=1` covers the minimal viable need safely |
| FEAT-005 | P4 | Multi-Workspace UI | ✅ Done |
| FEAT-006 | P5 | Unified Configuration Wizard CLI | 📋 Future |
| FEAT-007 | P5 | Test Data Management API Integration | 📋 Future |
| FEAT-008 | P5 | Cloud Device Grid Verification | 📋 Future |
| FEAT-009 | P4 | Team-Wide AI Usage Analytics | 📋 Future |
| FEAT-010 | P5 | GitHub Actions Market Integration | 📋 Future |
