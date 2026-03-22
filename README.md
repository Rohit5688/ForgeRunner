# 🚀 Forge Runner For VS Code

> The next generation of BDD testing tools for VS Code, built for scale, precision, and AI intelligence.

Welcome to **Forge Runner (v2)**, an enterprise-grade extension designed to natively bridge the gap between Playwright, Cucumber/Gherkin, and bleeding-edge Agentic AI tools via the Model Context Protocol (MCP).

---

## ✨ End-User Features

*   **Native VS Code Testing Integration**: Ditch heavy, slow webviews. We map your `.feature` files directly into the blazing-fast native VS Code Test Explorer. See live statuses, grouping, and execution times globally.
*   **Intelligent CodeLenses**: Open any `.feature` file to see inline `▶ Run`, `🐞 Debug`, and `✨ AI Discuss` buttons injected above every single scenario.
*   **Auto-Healing BDD Agent**: If a Playwright locator fails or times out, an `✨ AI Fix` button dynamically appears. Clicking it allows the Forge Agent to inspect the DOM, rewrite your Page Object Model, and rescue the test.
*   **One-Click Telemetry Teleportation**: Natively integrated `$(graph-line)` (HTML Reports) and `$(history)` (Trace Viewer) buttons exist right in your window title bars, executing complex CLI commands visually.
*   **AST-Powered Autocomplete**: Blazing fast type-ahead auto-complete and "Go-To-Definition" mapping powered by an injected Abstract Syntax Tree (AST), no more glitchy RegExp failures.
*   **Universal AI Providers**: Use the built-in **GitHub Copilot** (featuring deep-integrated GPT, Claude, and Gemini) for zero-configuration AI testing, or bind your own Anthropic API keys.

---

## 📚 Comprehensive Documentation

Check out our detailed guides to become a Forge Power User:

*   **[📖 User Guide](./docs/user_guide.md)**: Detailed breakdown of the Test Explorer, AI Sidepanel, CodeLenses, and Reporting UI.
*   **[🚀 Onboarding & Setup Guide](./docs/onboarding_guide.md)**: Step-by-step instructions from first-install to executing your first intelligent run.
*   **[💡 Do's and Don'ts](./docs/dos_and_donts.md)**: Best practices for succeeding with Agentic UI Generation and Playwright-BDD.
*   **[📊 Architecture Review](./docs/progress_review.md)**: A look under the hood at our DI Container and AST patterns.

---

## 🏗 Architecture (Under the Hood)

Built from the ground up on the **Dependency Injection** pattern, ensuring each component is decoupled and fully testable. Our MCP Bridge Service guarantees secure isolation between the IDE UI and the heavy Node.js AST/AI scraping workloads.

## 🛠 Developer Setup

1.  Clone the repository.
2.  Run `npm install`.
3.  Press `F5` in VS Code to launch the Extension Development Host.
