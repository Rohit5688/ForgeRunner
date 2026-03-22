import * as vscode from 'vscode';
import 'reflect-metadata';
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

    try { testController      = container.get<BddTestController>(TYPES.TestController); }
    catch (e: any) { logger.appendLine(`[DI ERROR] TestController: ${e.message}`); }

    try { mcpBridge           = container.get<McpBridgeService>(TYPES.McpBridge); }
    catch (e: any) { logger.appendLine(`[DI ERROR] McpBridgeService: ${e.message}`); }

    try { onboarding          = container.get<OnboardingService>(TYPES.Onboarding); }
    catch (e: any) { logger.appendLine(`[DI ERROR] Onboarding: ${e.message}`); }

    try { userStoreProvider   = container.get<UserStoreProvider>(TYPES.UserStoreProvider); }
    catch (e: any) { logger.appendLine(`[DI ERROR] UserStoreProvider: ${e.message}`); }

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
            const terminal = vscode.window.createTerminal('Playwright Report');
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
                const terminal = vscode.window.createTerminal('Playwright Trace');
                terminal.show();
                terminal.sendText(`npx playwright show-trace "${uri[0].fsPath}"`);
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
