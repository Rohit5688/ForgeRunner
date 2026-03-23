import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { BddTestController } from '../ui/testController.js';

@injectable()
export class ExecutionCodeLensProvider implements vscode.CodeLensProvider {

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.TestController) private testController: BddTestController,
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {}

    public async provideCodeLenses(
        document: vscode.TextDocument, 
        token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const lenses: vscode.CodeLens[] = [];

        try {
            const feature = await this.gherkinParser.parse(document.uri.fsPath, document.getText());

            for (const scenario of feature.scenarios) {
                const line = Math.max(0, scenario.line - 1);
                const range = new vscode.Range(line, 0, line, 0);

                const runLens = new vscode.CodeLens(range, {
                    title: '▶ Run',
                    command: 'forge-runner.runScenarioExternal',
                    arguments: [scenario.name, document.uri.fsPath]
                });
                
                const debugLens = new vscode.CodeLens(range, {
                    title: '🐞 Debug',
                    command: 'forge-runner.debugScenarioExternal',
                    arguments: [scenario.name, document.uri.fsPath]
                });

                const aiDiscussLens = new vscode.CodeLens(range, {
                    title: '✨ AI Discuss',
                    command: 'forge-runner.aiDiscussScenarioMcp',
                    arguments: [scenario.name, document.uri.fsPath]
                });

                lenses.push(runLens);
                lenses.push(debugLens);
                lenses.push(aiDiscussLens);
            }
        } catch (error: any) {
            this.logger.appendLine(`[ExecutionCodeLens] Failed parsing ${document.fileName}: ${error.message}`);
        }

        return lenses;
    }

    public aiDiscussScenario(scenarioName: string, uri: string) {
        vscode.commands.executeCommand('forge-runner.ai.chat').then(() => {
            const container = require('../core/container.js').container;
            const TYPES = require('../core/types.js').TYPES;
            const aiSidebar = container.get(TYPES.AiSidebar);
            if (aiSidebar) {
                const prompt = `I need help heavily analyzing the scenario: "${scenarioName}"` +
                               ` inside file \`${uri}\`. Please review it and suggest improvements or generate matching Page Object definitions using your MCP tools.`;
                aiSidebar.simulateUserMessage(prompt);
            }
        });
    }

    /**
     * Run a scenario — delegates to the TestController so Testing View + Test Results stay in sync.
     */
    public async runScenario(scenarioName: string, uri: string) {
        await this.testController.runByScenarioName(scenarioName, uri);
    }

    /**
     * Debug a scenario — delegates to the TestController.
     */
    public async debugScenario(scenarioName: string, uri: string) {
        await this.testController.debugByScenarioName(scenarioName, uri);
    }
}
