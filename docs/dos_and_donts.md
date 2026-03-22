# 💡 Forge Runner: Do's and Don'ts

Forge Runner operates both as a traditional code runner and an AI-driven, intent-based software engineering environment. To get the best out of its capabilities, particularly its **Auto-Healing Locator** feature, there are some strategic patterns you should follow.

---

## The Golden Rules of "Auto-Healing" 🩹

When a Playwright step fails due to a `TimeoutError` or a `strict mode violation`, Forge Runner pops up the **✨ AI Fix** CodeLens button. 

### ✅ DO: Use Clean Page Objects
The MCP `self_heal_test` AI tool expects your selectors to be located inside modular Page Object Model (POM) classes.
```typescript
export class LoginPage {
    readonly usernameInput: Locator;

    constructor(page: Page) {
        // AI can easily identify and hot-swap this string
        this.usernameInput = page.locator('input[name="user"]'); 
    }
}
```

### ❌ DON'T: Hardcode selectors dynamically inside steps
If you scatter `page.locator()` calls randomly deep inside complex `createBdd()` step definitions mixed with business logic, the AI will struggle to cleanly rewrite the source code file without accidentally breaking pure node functionality. 

---

## Chatting with the AI Sidebar 🤖

The `Forge: Open AI Chat` sidebar allows you to communicate with GitHub Copilot or Anthropic directly in the context of your currently active `.feature` file via MCP.

### ✅ DO: Be explicit with Test Generation commands
When asking the LLM to write a test suite, clearly specify the domains and boundaries.

**Good Prompt:**
> "I have an empty `checkout.feature` open. Use your `analyze_codebase` tool to find my `CartPage` object, and generate 3 scenarios covering a successful purchase using Playwright-BDD style step definitions."

### ❌ DON'T: Start typing commands without context
The MCP Server isolates the AI from arbitrarily reading your whole hard drive for security. If you just say "Write me a test", it won't know *what* you are trying to test unless you tell it which URL or Page Object to look at!

---

## Test Execution 🧪

### ✅ DO: Rely on the Native Testing View (`View > Testing`)
Forge Runner integrates perfectly with the official VS Code Test API. This means you can right-click folders, define run profiles, and leverage deep grouping trees (Group by Tag, Group by Folder) out of the box.

### ❌ DON'T: Try to execute tests via the integrated terminal standard `npm test` script unless you intentionally want raw CLI output
While you *can* run `npx playwright test`, using the native VS Code "Flask" icon (or clicking the inline `▶ Run` CodeLens in your `.feature` file) ensures that line-level breakpoints are hit, VS Code diagnostic colors appear cleanly, and the JSON results stream smoothly into your editor UI.

---

## Working with Traces and HTML Reports 📊

### ✅ DO: Use the Top-Bar Tool Icons
When you see `$(graph-line)` (HTML Report) or `$(history)` (Trace Viewer) in the top-right corner of your editor while editing a `.feature` file, click them! Forge Runner spawns a dedicated invisible terminal to launch the web servers automatically.

### ❌ DON'T: Manually spin up `npx playwright show-trace` on ports that are already bound
The native buttons manage the Terminal sessions explicitly to prevent `EADDRINUSE` port collision errors that crash VS Code's internal browser tabs.
