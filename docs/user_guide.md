<p align="center">
  <img src="../resources/image.png" width="150" alt="Forge Runner Logo">
</p>

# 📖 Forge Runner: User Guide

Welcome to the Forge Runner User Guide. This document breaks down the primary features of the extension and how you can interact with them on a day-to-day basis to speed up your BDD test development.

---

## 1. The Playwright-BDD Test Explorer 🧪

Forge Runner completely replaces the need for custom webviews by binding deeply into the native **VS Code Testing API**.

### How to use it:
1. Open the flask icon (🧪) in your VS Code Activity Bar.
2. The extension automatically recursively scans your workspace for `.feature` files.
3. You will see a tree representation of your Features, Rules, and Scenarios.
4. **Grouping & Filtering**: Use the native filter bar to filter by tags (e.g., `@smoke` or `@regression`) or string queries. 
5. **Execution**: Click the ▶ icon next to any folder, file, or scenario to execute it. The test output will stream natively into the Test Results panel.

---

## 2. In-Editor CodeLenses 🛠️

You do not have to leave your `.feature` file to run tests! Forge Runner automatically overlays interactive buttons directly above your Gherkin.

- **▶ Run**: Immediately launches the scenario in Playwright.
- **🐞 Debug**: Launches a Node.js debug session. Breakpoints set in your TypeScript step definitions will be honored!
- **✨ AI Discuss**: Opens the Forge AI Assistant and automatically prompts the agent to review the specific scenario you clicked on for potential improvements or Page Object generation.
- **✨ AI Fix**: (Dynamic) This button *only* appears if you run a test and it fails due to a Locator or Timeout violation. Clicking it will automatically dump the stack trace to the AI and execute a `self_heal_test` routine!

---

## 3. The Forge AI Assistant 🤖

Click the sparkle icon (✨) in your Activity Bar, or simply use the Command Palette `Forge: Open AI Chat`, to open the **Forge AI Sidebar**.

This is a natural-language interface hooked directly into your local `playwright-bdd-pom-mcp` daemon. 

### What it can do:
- **"Generate tests for..."**: The AI will natively execute `analyze_codebase` to read your existing Page Objects, and then use `generate_gherkin_pom_test_suite` to write new Feature and Step Definition files straight to your disk.
- **"Fix my locator..."**: The AI will execute `inspect_page_dom` in a hidden headless browser, dump the Accessibility Tree, and correct your TypeScript selector!

---

## 4. Telemetry Teleportation (Reports & Traces) 📊

When tests fail, investigating traces is critical. Instead of dropping to a Command Line, use the native icons added to both the **Testing View** and **Editor View** title bars!

- **Graph Icon `$(graph-line)`**: Executes `Forge: Show Playwright HTML Report`. Bootstraps your browser with the local static HTML report instantly.
- **History Icon `$(history)`**: Executes `Forge: Open Playwright Trace Viewer`. Opens a native OS File Picker—select your trace `.zip`, and it launches the Playwright Inspector.

---

## 5. Intelligent AST Autocomplete ⌨️

When typing in standard `.feature` files, Forge Runner parses your TypeScript workspace in the background.

- **Typeahead**: Begin typing `Given`, `When`, or `Then` and you will receive exact autocomplete suggestions mapped from your `createBdd()` step definitions.
- **Go-To-Definition**: `Ctrl+Click` (or `Cmd+Click`) on any step in your feature file to be teleported instantly to the exact line in the `.ts` file where that step is defined.

---

## 6. Multi-Framework Support

Forge Runner defaults to the `playwright-bdd` framework. If you are instead running a pure raw cucumber test suite, you can swap the environment executing in the Test Explorer!

1. Open VS Code Settings (`Ctrl+,`).
2. Search for `forge-runner.testing.framework`.
3. Change the dropdown from `playwright-bdd` to `cucumber`. 
4. The Test Explorer will now seamlessly proxy runs to `npx cucumber-js`.

---

## 7. Configuration Reference & Examples ⚙️

Forge Runner allows you to customize where it looks for files and how it executes tests. This is especially useful for complex or monorepo project structures.

To configure these, open your VS Code `settings.json` (Workspace or User) and add the following keys under `forge-runner.playwright`:

### Available Configuration Options

| Setting Key | Description | Default |
| :--- | :--- | :--- |
| `projectRoot` | The relative path from your VS Code Workspace root to the actual test project directory. | `""` |
| `configPath` | The name or relative path of the Playwright config file. | `"playwright.config.ts"` |
| `featureFolder` | The directory where your `.feature` files live, relative to `projectRoot`. | `""` (Searches everywhere) |
| `stepsFolder` | The directory where your step definitions live, relative to `projectRoot`. | `""` (Searches everywhere) |
| `stepsFilePattern` | A glob pattern to identify step definition files. | `""` (Defaults to `**/*.{ts,js,mjs,mts}`) |
| `tsconfigPath` | Path to your `tsconfig.json` for compilation before running test commands. | `""` |

### Example 1: Standard Project Structure
If you open VS Code directly in your testing project, you usually don't need much configuration. But to optimize performance by telling Forge Runner exactly where to look:

```json
{
    "forge-runner.playwright.featureFolder": "tests/features",
    "forge-runner.playwright.stepsFolder": "tests/steps",
    "forge-runner.playwright.stepsFilePattern": "*.{ts,js}"
}
```
*Note: This tells Forge Runner to look for scenarios inside `tests/features/**/*.feature` and steps inside `tests/steps/**/*.{ts,js}`.*

### Example 2: Monorepo or Nested Project
If your VS Code workspace is at the root of a large repository, but your UI automation lives in a sub-folder (e.g., `apps/e2e-tests`), you **must** use `projectRoot`.

```json
{
    "forge-runner.playwright.projectRoot": "apps/e2e-tests",
    "forge-runner.playwright.configPath": "playwright.config.ts",
    "forge-runner.playwright.featureFolder": "src/features",
    "forge-runner.playwright.stepsFolder": "src/step-definitions",
    "forge-runner.playwright.stepsFilePattern": "*.steps.ts"
}
```
*How it works: Forge Runner will navigate to `[Workspace_Root]/apps/e2e-tests` before running `npx bddgen` and `npx playwright test`. It will only scan `apps/e2e-tests/src/features/` for feature files.*
