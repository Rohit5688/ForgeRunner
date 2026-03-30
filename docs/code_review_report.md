# 🔬 Cross-Project Code Review Report

**Scope**: TestForge · AppForge · ForgeRunner  
**Reference Docs**: `BUG-016_Playwright_Import_Strategy.md`, `qa_progress_walkthrough.md`, `BUG-001_ForgeRunner_QA_Fixes.md`, `feature_gap_analysis.md`  
**Date**: 2026-03-30  
**Status**: ✅ 3 Fixes Applied

---

## ✅ Verified: BUG-016 — TestForge Import Strategy

All six components listed in BUG-016 audited and **correctly implemented**.

| Component | File:Line | Import Rule | Status |
|:---|:---|:---|:---|
| `playwright.config.ts` template | `ProjectSetupService.ts:129` | `defineConfig, devices` from `@playwright/test` | ✅ |
| `BasePage.ts` template | `ProjectSetupService.ts:187` | `Page, expect` from `@playwright/test` | ✅ |
| `package.json` template | `ProjectSetupService.ts:104-106` | Comment: do NOT add `@playwright/test` directly | ✅ |
| AI prompt rules | `TestGenerationService.ts:148-156` | `createBdd` ← `playwright-bdd`; `test/expect` ← `@playwright/test` | ✅ |
| Fixture prompt | `FixtureDataService.ts:30` | `import { test as base } from '@playwright/test'` | ✅ |
| Maintenance guidance | `ProjectMaintenanceService.ts:91-94` | Comment explains implicit dep strategy | ✅ |
| Health check | `EnvironmentCheckService.ts:113-131` | Warns when `@playwright/test` found in devDeps | ✅ |

---

## ✅ Verified: BUG-001 — ForgeRunner QA Fixes

All five P1–P3 fixes audited against `playwrightBddAdapter.ts` and `mcpBridge.ts`.

| Issue | Location | Status |
|:---|:---|:---|
| P1 — Command injection | `sanitizeShellArg()` L21-26 | ✅ Platform-aware quoting |
| P2 — Hardcoded `npx` | `getPackageManagerPrefix()` L28-33 | ✅ yarn/pnpm/bun detection |
| P2 — Brittle MCP auto-discovery | `mcpBridge.ts:75` | ✅ `isFile() && endsWith('.js')` guard |
| P3 — Debug sessions dropping results | `debugTests:255-310` | ✅ `PLAYWRIGHT_JSON_OUTPUT_NAME` + parsed in session handler |
| P3 — Orphaned temp files (runTests) | `playwrightBddAdapter.ts:205-214` | ✅ `finally` block with `unlinkSync` |

---

## 🔴 New Bugs Found & Fixed

### Bug A — Shell Injection in `showTrace` Command (ForgeRunner · P1)
**File**: `src/extension.ts:193` → **Fixed**

The `showTrace` command directly interpolated the OS-dialog file path into a terminal string:
```typescript
// BEFORE (vulnerable)
terminal.sendText(`npx playwright show-trace "${uri[0].fsPath}"`);
```
Added module-level `escapeForTerminal()` helper (mirrors `sanitizeShellArg` logic) and applied it:
```typescript
// AFTER
terminal.sendText(`npx playwright show-trace ${escapeForTerminal(uri[0].fsPath)}`);
```

### Bug B — `debugTests` Missing Outer `finally` Block (ForgeRunner · P3)
**File**: `src/adapters/playwrightBddAdapter.ts:220-320` → **Fixed**

BUG-001 required `finally` blocks **universally** across `runTests` AND `debugTests`. `runTests` had it; `debugTests` had split cleanup between `catch` and the debug session termination handler. If `startDebugging()` threw synchronously, `run.end()` was called in `catch` — but the missing `finally` meant no `run.end()` on exceptions before `startDebugging`. 

Added `sessionStarted` flag + outer `finally` that only calls `run.end()` if the debug session never launched (to avoid double-ending the run that the session handler manages):
```typescript
} finally {
    if (!sessionStarted) {
        if (jsonOutputFile && fs.existsSync(jsonOutputFile)) {
            try { fs.unlinkSync(jsonOutputFile); } catch (e) {}
        }
        run.end();
    }
}
```

### Bug C — `FixtureDataService` Output Format Mismatch (TestForge · P2)
**File**: `src/services/FixtureDataService.ts:41-43` → **Fixed**

The fixture prompt instructed the LLM to return "ONLY the raw TypeScript code block". But `validate_and_write` (the downstream MCP tool) expects `{ files: [{ path, content }] }`. This caused a silent tool-chain break.

Updated to instruct the LLM to return the standard JSON schema:
```json
{
  "files": [
    { "path": "fixtures/user.fixture.ts", "content": "/* TS source */" }
  ]
}
```

---

## 🟡 Documented Gap (No Code Change)

### Gap — `checkBrowsersDownloaded` May False-Warn (TestForge · Low)
**File**: `EnvironmentCheckService.ts:156`

Checks `node_modules/playwright/.local-browsers` but `playwright-bdd` installs browsers through `@playwright/test` which may store them in the global `~/.cache/ms-playwright`. The existing fallback to `PLAYWRIGHT_BROWSERS_PATH` and `npx playwright --version` partially mitigates this. Low risk — inline comment added for visibility.

---

## 📋 Feature Gap Status: ForgeRunner v1 → v2

| Category | v1 Capability | v2 Status | MCP-Enhanced Path |
|:---|:---|:---|:---|
| Editor Context Menus | Format, Generate Steps, Validate | ❌ Roadmap | Trigger `generate_gherkin_pom_test_suite` via right-click |
| Test Explorer Filters | Tag/Status filters, History | 🔶 Partial | `--grep` works; History/Analytics UI missing |
| Native BDD Debugger | Step-by-step, BDD breakpoints | ❌ Roadmap | Requires custom DAP adapter |
| CI/CD Dashboard | GitHub Workflows, Remote Reports | ❌ Roadmap | AI reads CI logs + explains failures via MCP |
| Multi-Workspace UI | Show/Switch/Search workspaces | 🔶 Architectural | Architecture supports it; UI panels not wired |

---

## 📊 Health Summary

| Project | Doc Bugs Verified | New Bugs Fixed | Regression Risk |
|:---|:---|:---|:---|
| **TestForge** | BUG-016 ✅ (6/6) | 1 (FixtureDataService format) | None |
| **ForgeRunner** | BUG-001 ✅ (5/5) | 2 (trace injection, debug finally) | None |
| **AppForge** | BUG-04, BUG-12 ✅ | 0 | — |
