# 🤖 Agent Working Protocol: Token-Aware & Granular Implementation

This protocol MUST be followed by any AI Agent (Antigravity, etc.) performing tasks in the AppForge / TestForge / ForgeRunner ecosystem. These rules ensure implementation completeness and architectural stability.

---

## ⚡ 1. Token-Aware Execution (Prevents Incomplete Work)

To avoid truncated file writes or "brain fog" during complex refactors, agents must manage the context window proactively:

1.  **Turbo Analysis First**: ALWAYS use `execute_sandbox_code` (Turbo Mode) or targeted `grep` calls for research. DO NOT `view_file` on large source files (>500 lines) multiple times, as this rapidly depletes the token budget.
2.  **Verify Write Capacity**: Before performing a `multi_replace_file_content` or `write_to_file` call, assess if the task is too large for a single turn. If the change exceeds ~200 lines, break it into **sequential tool calls**.
3.  **Checkpointing**: For multi-step tasks (e.g., "Implement FEAT-001"), the agent must:
    *   State the sub-steps clearly.
    *   Perform one atomic change (e.g., update one service).
    *   Summarize state and prompt for the next sub-step.
4.  **Refuse Over-Saturation**: If a USER_REQUEST asks for "Fix all 10 bugs in one go," the agent MUST respond with a plan and proceed bug-by-bug to ensure each fix is fully context-aware and complete.

---

## 🔍 2. Atomic Bug Resolution (Prevents Gaps & Regressions)

To ensure high-precision fixes without breaking side-effects, follow the **Trace-Audit-Verify (TAV)** cycle:

1.  **Isolation (Audit)**:
    *   Don't just fix the reported line. Search for the same pattern across the workspace (e.g., check both `extension.ts` AND `adapters/`).
    *   Map the "Blast Radius": Check where the modified function/service is called.
2.  **Granular Replacement**:
    *   Use `replace_file_content` targeting specific line ranges instead of overwriting entire files.
    *   Avoid combining unrelated fixes (e.g., a security fix and a UI fix) in a single tool call.
3.  **The "Gap Check" Rule**:
    *   After a fix, the agent must ask: *"Is there an equivalent vulnerability in the other projects (AppForge/TestForge)?"*
    *   Verify if the fix requires a corresponding change in the **System Instructions** (Prompts) to prevent the AI from re-generating the bug in the future.
4.  **Verification**:
    *   Every fix must be followed by a verification step (e.g., checking for syntax errors, running a specific test command, or manually auditing the resulting diff).

---

## 🛠️ 3. Prompt-Driven Maintenance

Since this is a generation-heavy framework, a code fix is only 50% complete until the **prompts** are updated.

*   **Rule**: If a bug was caused by an AI-generated pattern (like BUG-008's format mismatch), you MUST update the corresponding `PromptService` or `SystemInstruction` immediately.
*   **Knowledge Persistence**: Use the `train_on_example` tool (if available) or update `mcp-learning.json` to ensure the "leveled-up" logic persists across sessions.
