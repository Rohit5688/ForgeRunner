import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { TestStateStore } from '../core/testStateStore.js';
import { AiSidebarProvider } from '../ui/aiSidebar.js';

@injectable()
export class AutoHealCodeLensProvider implements vscode.CodeLensProvider {

    // Keywords that highly indicate a UI locator failure rather than a logical assertion failure
    private readonly LOCATOR_ERROR_HEURISTICS = [
        'locator', 'timeout', 'not found', 'waiting for', 'strict mode violation', 
        'element is not attached', 'navigating to', 'net::ERR'
    ];

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.TestStateStore) private testStateStore: TestStateStore,
        @inject(TYPES.AiSidebar) private aiSidebar: AiSidebarProvider,
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {}

    public async provideCodeLenses(
        document: vscode.TextDocument, 
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];

        try {
            const feature = await this.gherkinParser.parse(document.uri.fsPath, document.getText());

            const seenLines = new Set<number>();

            for (const scenario of feature.scenarios) {
                // Check if this scenario recently failed
                const errorMsg = this.testStateStore.getFailure(scenario.id);
                
                if (errorMsg) {
                    const isLocatorIssue = this.LOCATOR_ERROR_HEURISTICS.some(h => errorMsg.toLowerCase().includes(h));
                    
                    if (isLocatorIssue) {
                        const targetLine = scenario.outlineLine ?? scenario.line;
                        const line = Math.max(0, targetLine - 1);
                        
                        // Prevent stacking multiple Auto-Heal buttons on Scenario Outlines 
                        if (seenLines.has(line)) {
                            continue;
                        }
                        seenLines.add(line);

                        const range = new vscode.Range(line, 0, line, 0);

                        const lens = new vscode.CodeLens(range, {
                            title: '🩹 Auto-Heal Selector (Forge AI)',
                            command: 'forge-runner.autoHealMcp',
                            arguments: [scenario.name, errorMsg, document.uri.fsPath]
                        });
                        lenses.push(lens);
                    }
                }
            }
        } catch (error: any) {
            this.logger.appendLine(`[AutoHealCodeLens] Failed parsing ${document.fileName}: ${error.message}`);
        }

        return lenses;
    }

    /**
     * Executes the Auto-Healing logic via AI orchestration.
     */
    public async autoHeal(scenarioName: string, errorMessage: string, featureUri: string) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Forge AI: Routing failure for "${scenarioName}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                // Trigger the AI Controller with instructions to use self_heal_test MCP natively in chat
                const prompt = `The scenario "${scenarioName}" just failed in Playwright with the following error:\n\n` +
                               `\`\`\`\n${errorMessage}\n\`\`\`\n\n` +
                               `This appears to be a broken UI locator or timeout. Please use your MCP tools, ` +
                               `specifically \`self_heal_test\` and \`inspect_page_dom\` if necessary, to analyze this failure. ` +
                               `Determine the correct selector and explain how to apply the fix to the Page Object.`;

                await this.aiSidebar.simulateUserMessage(prompt);
                
                vscode.window.showInformationMessage('Auto-Heal Analysis shipped to Forge AI sidebar.');
            } catch (error: any) {
                vscode.window.showErrorMessage(`Forge AI Auto-Heal Failed: ${error.message}`);
            }
        });
    }
}
