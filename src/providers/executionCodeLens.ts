import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';

@injectable()
export class ExecutionCodeLensProvider implements vscode.CodeLensProvider {

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
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

    public runScenario(scenarioName: string, uri: string) {
        const terminal = vscode.window.createTerminal(`BDD Run: ${scenarioName}`);
        terminal.show();
        terminal.sendText(`npx playwright test --grep "${scenarioName.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&')}"`);
    }

    public debugScenario(scenarioName: string, uri: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found to launch debug session.');
            return;
        }

        const debugConfig: vscode.DebugConfiguration = {
            type: 'node',
            request: 'launch',
            name: 'Debug Playwright BDD',
            cwd: workspaceFolder.uri.fsPath,
            runtimeExecutable: 'npx',
            runtimeArgs: [
                'playwright',
                'test',
                '--grep',
                `"${scenarioName.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&')}"`
            ],
            env: { PWDEBUG: 'console' },
            console: 'internalConsole',
            internalConsoleOptions: 'neverOpen',
            outputCapture: 'std'
        };

        vscode.debug.startDebugging(workspaceFolder, debugConfig);
    }
}
