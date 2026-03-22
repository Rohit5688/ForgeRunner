import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { TsParser } from '../parsers/tsParser.js';
import { MatchEngine } from '../core/matcher.js';
import { AiController } from '../core/llm/aiController.js';
import { WorkspaceManager } from '../core/workspaceManager.js';
import { AiSidebarProvider } from '../ui/aiSidebar.js';

@injectable()
export class StepGenerationCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.TsParser) private tsParser: TsParser,
        @inject(TYPES.MatchEngine) private matchEngine: MatchEngine,
        @inject(TYPES.AiSidebar) private aiSidebar: AiSidebarProvider,
        @inject(TYPES.WorkspaceManager) private workspaceManager: WorkspaceManager,
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {
        // Automatically fire CodeLens refresh when the user types
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (e.document.fileName.endsWith('.feature')) {
                this._onDidChangeCodeLenses.fire();
            }
        });
    }

    public async provideCodeLenses(
        document: vscode.TextDocument, 
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];

        try {
            const feature = await this.gherkinParser.parse(document.uri.fsPath, document.getText());

            for (const scenario of feature.scenarios) {
                for (const step of scenario.steps) {
                    
                    const isMatched = await this.isStepMatched(step.text);
                    
                    if (!isMatched) {
                        const line = Math.max(0, step.line - 1);
                        const range = new vscode.Range(line, 0, line, 0);

                        const lens = new vscode.CodeLens(range, {
                            title: '✨ Auto-Generate Step (Forge AI)',
                            command: 'forge-runner.generateStepMcp',
                            arguments: [step.text, scenario.name, document.uri.fsPath]
                        });
                        lenses.push(lens);
                    }
                }
            }
        } catch (error: any) {
            this.logger.appendLine(`[CodeLens] Failed parsing ${document.fileName}: ${error.message}`);
        }

        return lenses;
    }

    private async isStepMatched(stepText: string): Promise<boolean> {
        const cleanStepText = stepText.replace(/^(Given|When|Then|And|But|\*)\s+/, '');
        const tsFiles = await this.workspaceManager.findStepDefinitionFiles();
        for (const file of tsFiles) {
            const content = await this.workspaceManager.readFile(file);
            const definitions = this.tsParser.parse(file.fsPath, content);
            
            for (const define of definitions) {
                const result = this.matchEngine.match(cleanStepText, define.pattern);
                if (result.isMatch) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Executes the generation logic.
     */
    public async generateStep(stepText: string, scenarioName: string, featureUri: string) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Forge AI: Sending generation request...`,
            cancellable: false
        }, async (progress) => {
            try {
                const prompt = `I have a missing BDD step in the scenario "${scenarioName}".\n` +
                               `The step text is: "${stepText}".\n\n` +
                               `Please use your MCP tools \`analyze_codebase\` to find existing Page Objects, ` +
                               `and write the exact Playwright-BDD TypeScript step definition for this text. ` +
                               `Output the final Typescript code and explain where to place it.`;

                // Ship the prompt directly to the webview chat natively as if user typed it!
                await this.aiSidebar.simulateUserMessage(prompt);
                
                vscode.window.showInformationMessage('Generation forwarded to Forge AI Sidebar.');
            } catch (error: any) {
                vscode.window.showErrorMessage(`Forge AI Generation Failed: ${error.message}`);
            }
        });
    }
}
