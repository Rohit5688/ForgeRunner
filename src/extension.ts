import * as vscode from 'vscode';
import * as path from 'path';
import 'reflect-metadata';

/**
 * Safely escapes a file-system path for use inside a VS Code terminal sendText() call.
 * Wraps in double-quotes and escapes embedded double-quotes.
 * Matches the escaping strategy used in PlaywrightBddAdapter.sanitizeShellArg().
 */
function escapeForTerminal(filePath: string): string {
    return `"${filePath.replace(/"/g, '""')}"`;
}
import { container } from './core/container.js';
import { TYPES } from './core/types.js';
import { BddTestController } from './ui/testController.js';
import { BddNavigationProvider } from './providers/navigationProvider.js';
import { AiSidebarProvider } from './ui/aiSidebar.js';
import { McpBridgeService } from './services/mcpBridge.js';
import { BddCompletionProvider } from './providers/completionProvider.js';
import { OnboardingService } from './ui/onboarding.js';
import { UserStoreProvider } from './ui/userStoreView.js';
import { FormattingProvider } from './providers/formattingProvider.js';
import { StepGenerationCodeLensProvider } from './providers/stepGenerationCodeLens.js';
import { AutoHealCodeLensProvider } from './providers/autoHealCodeLens.js';
import { ExecutionCodeLensProvider } from './providers/executionCodeLens.js';
import { AutoDiscoveryService } from './core/autoDiscovery.js';
import { TestHistoryView } from './ui/testHistoryView.js';
import { WorkspaceExplorerProvider } from './ui/workspaceExplorer.js';

/**
 * Forge Runner v2 Activation
 */
export async function activate(context: vscode.ExtensionContext) {
    const logger = vscode.window.createOutputChannel('Forge Runner');
    logger.show(true); // auto-show so user can see errors
    container.bind<vscode.OutputChannel>(TYPES.Logger).toConstantValue(logger);
    logger.appendLine('[Startup] Extension activated. Bootstrapping DI container...');

    // ── Step 1: resolve early dependencies ────────────────────────────────
    let navProvider: BddNavigationProvider | undefined;
    let completionProvider: BddCompletionProvider | undefined;
    let formattingProvider: FormattingProvider | undefined;
    let stepGenProvider: StepGenerationCodeLensProvider | undefined;
    let autoHealProvider: AutoHealCodeLensProvider | undefined;
    let executionCodeLensProvider: ExecutionCodeLensProvider | undefined;
    let aiSidebar: AiSidebarProvider | undefined;
    let testController: BddTestController | undefined;
    let mcpBridge: McpBridgeService | undefined;
    let onboarding: OnboardingService | undefined;
    let userStoreProvider: UserStoreProvider | undefined;
    let autoDiscoveryService: AutoDiscoveryService | undefined;
    let testHistoryView: TestHistoryView | undefined;
    let workspaceExplorer: WorkspaceExplorerProvider | undefined;

    try { navProvider         = container.get<BddNavigationProvider>(TYPES.NavigationProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] NavigationProvider: ${e.message}`); }

    try { completionProvider  = container.get<BddCompletionProvider>(TYPES.CompletionProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] CompletionProvider: ${e.message}`); }

    try { formattingProvider  = container.get<FormattingProvider>(TYPES.FormattingProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] FormattingProvider: ${e.message}`); }

    try { stepGenProvider     = container.get<StepGenerationCodeLensProvider>(TYPES.StepGenerationCodeLensProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] StepGenerationCodeLensProvider: ${e.message}`); }

    try { autoHealProvider    = container.get<AutoHealCodeLensProvider>(TYPES.AutoHealCodeLensProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] AutoHealCodeLensProvider: ${e.message}`); }

    try { executionCodeLensProvider = container.get<ExecutionCodeLensProvider>(TYPES.ExecutionCodeLensProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] ExecutionCodeLensProvider: ${e.message}`); }

    try { aiSidebar           = container.get<AiSidebarProvider>(TYPES.AiSidebar); }
    catch (e: any) { logger.appendLine(`[DI ERROR] AiSidebarProvider: ${e.message}`); }

    try {
        autoDiscoveryService = container.get<AutoDiscoveryService>(TYPES.AutoDiscoveryService);
        // Note: autoDiscoveryService.run() is now called in the FEAT-005 block below
        // (after workspaceExplorer is registered) so the tree refresh can be chained.
    }
    catch (e: any) { logger.appendLine(`[DI ERROR] AutoDiscoveryService: ${e.message}`); }

    try { testController      = container.get<BddTestController>(TYPES.TestController); }
    catch (e: any) { logger.appendLine(`[DI ERROR] TestController: ${e.message}`); }

    try { mcpBridge           = container.get<McpBridgeService>(TYPES.McpBridge); }
    catch (e: any) { logger.appendLine(`[DI ERROR] McpBridgeService: ${e.message}`); }

    try { onboarding          = container.get<OnboardingService>(TYPES.Onboarding); }
    catch (e: any) { logger.appendLine(`[DI ERROR] Onboarding: ${e.message}`); }

    try { userStoreProvider   = container.get<UserStoreProvider>(TYPES.UserStoreProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] UserStoreProvider: ${e.message}`); }

    try { testHistoryView     = container.get<TestHistoryView>(TYPES.TestHistoryView); }
    catch (e: any) { logger.appendLine(`[DI ERROR] TestHistoryView: ${e.message}`); }

    try { workspaceExplorer   = container.get<WorkspaceExplorerProvider>(TYPES.WorkspaceExplorer); }
    catch (e: any) { logger.appendLine(`[DI ERROR] WorkspaceExplorer: ${e.message}`); }

    logger.appendLine('[DI] All services resolved. Registering providers...');

    // ── Step 2: register providers that successfully resolved ──────────────
    const featureSelector: vscode.DocumentSelector = { scheme: 'file', pattern: '**/*.feature' };

    if (navProvider) {
        context.subscriptions.push(
            vscode.languages.registerDefinitionProvider(featureSelector, navProvider),
            vscode.languages.registerHoverProvider(featureSelector, navProvider)
        );
    }
    if (completionProvider) {
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(featureSelector, completionProvider, ' ', '{')
        );
    }
    if (formattingProvider) {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(featureSelector, formattingProvider)
        );
    }
    if (stepGenProvider) {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(featureSelector, stepGenProvider)
        );
    }
    if (autoHealProvider) {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(featureSelector, autoHealProvider)
        );
    }
    if (executionCodeLensProvider) {
        context.subscriptions.push(
            vscode.languages.registerCodeLensProvider(featureSelector, executionCodeLensProvider)
        );
    }

    // ── Step 3: Register webview providers ───────────────────────────────
    if (aiSidebar) {
        logger.appendLine('[UI] Registering Forge AI Sidebar webview...');
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('forgeAiSidebar', aiSidebar, {
                webviewOptions: { retainContextWhenHidden: true }
            })
        );
        logger.appendLine('[UI] Forge AI Sidebar registered successfully.');
    } else {
        logger.appendLine('[UI ERROR] AiSidebar failed to resolve — sidebar will be blank!');
    }

    if (userStoreProvider) {
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('forgeUserStore', userStoreProvider)
        );
    }

    // FEAT-005: Register Workspace Explorer tree view
    if (workspaceExplorer) {
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider('forgeWorkspaceExplorer', workspaceExplorer)
        );
        // Refresh tree after auto-discovery completes
        autoDiscoveryService?.run()
            .then(() => workspaceExplorer?.refresh())
            .catch(e => logger.appendLine(`[AutoDiscovery] Error: ${e}`));
    }

    if (testController) {
        context.subscriptions.push(testController.nativeController);
    }

    // ── Step 4: register commands ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('forge-runner.showOnboarding', () => {
            onboarding?.show(context);
        }),
        vscode.commands.registerCommand('forge-runner.ai.chat', () => {
            vscode.commands.executeCommand('forgeAiSidebar.focus');
        }),
        vscode.commands.registerCommand('forge-runner.generateStepMcp', (stepText, scenarioName, uri) => {
            stepGenProvider?.generateStep(stepText, scenarioName, uri);
        }),
        vscode.commands.registerCommand('forge-runner.autoHealMcp', (scenarioName, errorMsg, uri) => {
            autoHealProvider?.autoHeal(scenarioName, errorMsg, uri);
        }),
        vscode.commands.registerCommand('forge-runner.runScenarioExternal', (scenarioName, uri) => {
            executionCodeLensProvider?.runScenario(scenarioName, uri);
        }),
        vscode.commands.registerCommand('forge-runner.debugScenarioExternal', (scenarioName, uri) => {
            executionCodeLensProvider?.debugScenario(scenarioName, uri);
        }),
        vscode.commands.registerCommand('forge-runner.aiDiscussScenarioMcp', (scenarioName, uri) => {
            executionCodeLensProvider?.aiDiscussScenario(scenarioName, uri);
        }),
        vscode.commands.registerCommand('forge-runner.reconnectMcp', () => {
            mcpBridge?.connect();
        }),
        vscode.commands.registerCommand('forge-runner.showReport', () => {
            const wsFolder = vscode.workspace.workspaceFolders?.[0];
            const config = vscode.workspace.getConfiguration('forge-runner.playwright');
            const projectRoot = config.get<string>('projectRoot', '');
            const basePath = wsFolder?.uri.fsPath || '';
            const cwd = projectRoot ? path.join(basePath, projectRoot) : basePath;
            const terminal = vscode.window.createTerminal({ name: 'Playwright Report', cwd });
            terminal.show();
            terminal.sendText('npx playwright show-report');
        }),
        vscode.commands.registerCommand('forge-runner.showTrace', async () => {
            const uri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: false,
                filters: { 'Traces': ['zip'] },
                title: 'Select Playwright Trace File'
            });
            if (uri && uri[0]) {
                const wsFolder = vscode.workspace.workspaceFolders?.[0];
                const config = vscode.workspace.getConfiguration('forge-runner.playwright');
                const projectRoot = config.get<string>('projectRoot', '');
                const basePath = wsFolder?.uri.fsPath || '';
                const cwd = projectRoot ? path.join(basePath, projectRoot) : basePath;
                const terminal = vscode.window.createTerminal({ name: 'Playwright Trace', cwd });
                terminal.show();
                // BUG-A FIX: escapeForTerminal() prevents shell injection from attacker-controlled
                // file paths (e.g., paths containing spaces or embedded quotes on Windows).
                terminal.sendText(`npx playwright show-trace ${escapeForTerminal(uri[0].fsPath)}`);
            }
        }),
        // FEAT-002: Test History View
        vscode.commands.registerCommand('forge-runner.showTestHistory', () => {
            testHistoryView?.show(context);
        }),

        // FEAT-005: Switch active workspace from the Workspace Explorer tree
        vscode.commands.registerCommand('forge-runner.workspace.switchTo', async (ws: { projectRoot: string; featureFolder: string; stepsFolder: string; name: string }) => {
            try {
                if (!ws) { return; }
                const confirm = await vscode.window.showInformationMessage(
                    `Switch active project to "${ws.name}"?`,
                    { modal: false },
                    'Switch'
                );
                if (confirm !== 'Switch') { return; }

                const config = vscode.workspace.getConfiguration('forge-runner.playwright');
                await config.update('projectRoot', ws.projectRoot, vscode.ConfigurationTarget.Workspace);
                if (ws.featureFolder) {
                    await config.update('featureFolder', ws.featureFolder, vscode.ConfigurationTarget.Workspace);
                }
                if (ws.stepsFolder) {
                    await config.update('stepsFolder', ws.stepsFolder, vscode.ConfigurationTarget.Workspace);
                }
                vscode.window.showInformationMessage(`Forge: Active project switched to "${ws.name}".`);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge: Workspace switch failed — ${e.message}`);
            }
        }),

        // ── FEAT-001: AI-Powered .feature Context Menu Commands ──────────────
        // Safety contract: each handler MUST be fully defensive (null-check aiSidebar,
        // null-check activeEditor) and MUST NOT throw to the extension host.
        vscode.commands.registerCommand('forge-runner.feature.generateSteps', async () => {
            try {
                const doc = vscode.window.activeTextEditor?.document;
                if (!doc) { return; }
                const prompt = `I need step definitions generated for this .feature file.\n\n` +
                    `File: ${doc.fileName}\n\nContent:\n\`\`\`gherkin\n${doc.getText().slice(0, 3000)}\n\`\`\`\n\n` +
                    `Please use your MCP tools \`analyze_codebase\` and \`generate_gherkin_pom_test_suite\` ` +
                    `to generate TypeScript Playwright-BDD step definitions matching the existing project structure.`;
                await aiSidebar?.simulateUserMessage(prompt);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge AI: Generate Steps failed — ${e.message}`);
            }
        }),

        vscode.commands.registerCommand('forge-runner.feature.validateCoverage', async () => {
            try {
                const doc = vscode.window.activeTextEditor?.document;
                if (!doc) { return; }
                const prompt = `Please validate the step coverage for this feature file:\n\n` +
                    `File: ${doc.fileName}\n\nContent:\n\`\`\`gherkin\n${doc.getText().slice(0, 3000)}\n\`\`\`\n\n` +
                    `Use your MCP tool \`analyze_coverage\` on this file and report which steps ` +
                    `have missing implementations, which are covered, and any negative/a11y gaps.`;
                await aiSidebar?.simulateUserMessage(prompt);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge AI: Validate Coverage failed — ${e.message}`);
            }
        }),

        vscode.commands.registerCommand('forge-runner.feature.extractOutline', async () => {
            try {
                const doc = vscode.window.activeTextEditor?.document;
                if (!doc) { return; }
                const prompt = `Please analyze this feature file and extract any repeated scenario patterns ` +
                    `into a Scenario Outline with an Examples table:\n\n` +
                    `File: ${doc.fileName}\n\nContent:\n\`\`\`gherkin\n${doc.getText().slice(0, 3000)}\n\`\`\`\n\n` +
                    `Identify scenarios that share the same step structure but differ in data values. ` +
                    `Output the refactored Gherkin with proper Scenario Outline + Examples syntax.`;
                await aiSidebar?.simulateUserMessage(prompt);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge AI: Extract Outline failed — ${e.message}`);
            }
        }),

        vscode.commands.registerCommand('forge-runner.feature.formatFile', async () => {
            try {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('.feature')) { return; }
                // Delegate to the already-registered formatting provider via VS Code's built-in API.
                // This is safer than calling formattingProvider directly — it goes through
                // VS Code's edit pipeline which handles undo history correctly.
                await vscode.commands.executeCommand(
                    'editor.action.formatDocument',
                    editor.document.uri
                );
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge: Format failed — ${e.message}`);
            }
        }),

        // ── FEAT-003: CI/CD Failure Analysis ─────────────────────────────────
        vscode.commands.registerCommand('forge-runner.analyzeCIFailure', async () => {
            try {
                // Step 1: ask user to choose input mode
                const mode = await vscode.window.showQuickPick(
                    [
                        { label: '$(terminal) Paste CI Log', description: 'Paste raw terminal / GitHub Actions failure output', value: 'paste' },
                        { label: '$(globe) Enter GitHub Actions URL', description: 'Provide a run URL for context (AI will analyze based on URL)', value: 'url' }
                    ],
                    { placeHolder: 'How would you like to provide the CI failure?', title: 'Forge: Analyze CI Failure' }
                );
                if (!mode) { return; }

                let failureContent = '';

                if (mode.value === 'paste') {
                    failureContent = await vscode.window.showInputBox({
                        prompt: 'Paste the raw CI failure log (first 3000 chars will be used)',
                        placeHolder: 'Error: Test timeout of 30000ms exceeded...',
                        ignoreFocusOut: true
                    }) ?? '';
                } else {
                    const url = await vscode.window.showInputBox({
                        prompt: 'Enter the GitHub Actions run URL',
                        placeHolder: 'https://github.com/owner/repo/actions/runs/12345678',
                        ignoreFocusOut: true,
                        validateInput: (v) => v.startsWith('http') ? null : 'Must be a valid URL'
                    }) ?? '';
                    if (url) { failureContent = `GitHub Actions Run: ${url}`; }
                }

                if (!failureContent.trim()) { return; }

                const prompt = `Please analyze this CI/CD test failure and identify the root cause:\n\n` +
                    `\`\`\`\n${failureContent.slice(0, 3000)}\n\`\`\`\n\n` +
                    `Use your MCP tool \`self_heal_test\` with this output as \`testOutput\`. ` +
                    `Determine if this is a SCRIPTING issue (broken locator or bad selector) or an APPLICATION issue (wrong data or regression). ` +
                    `Provide a concrete fix recommendation with the exact code change needed.`;

                await aiSidebar?.simulateUserMessage(prompt);
            } catch (e: any) {
                vscode.window.showErrorMessage(`Forge AI: CI Analysis failed — ${e.message}`);
            }
        })
    );

    // ── Step 5: connect MCP async (non-blocking) ──────────────────────────
    if (mcpBridge) {
        const config = vscode.workspace.getConfiguration('forge-runner');
        const mcpPath = config.get<string>('ai.mcpServerPath');

        if (!mcpPath) {
            onboarding?.show(context);
        } else {
            Promise.race([
                mcpBridge.connect(),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout')), 15000)
                )
            ])
            .then(() => logger.appendLine('AI Engine: Connected to MCP Bridge.'))
            .catch(err => logger.appendLine(`AI Engine: Connection failed: ${err.message}`));
        }
    }

    logger.appendLine('Forge Runner v2 activated successfully.');
}

export function deactivate() {}
