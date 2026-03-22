import * as vscode from 'vscode';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@injectable()
export class ExecutionCodeLensProvider implements vscode.CodeLensProvider {

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {}

    /**
     * Resolves the effective execution directory from workspace + projectRoot config.
     */
    private getExecutionContext(): { cwd: string; configPath: string; tsconfigPath: string } {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const configPath = config.get<string>('configPath', 'playwright.config.ts');
        const tsconfigPath = config.get<string>('tsconfigPath', 'tsconfig.json');
        const projectRoot = config.get<string>('projectRoot', '');

        const basePath = workspaceFolder?.uri.fsPath || '';
        const cwd = projectRoot ? path.join(basePath, projectRoot) : basePath;

        return { cwd, configPath, tsconfigPath };
    }

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

    public async runScenario(scenarioName: string, uri: string) {
        const { cwd, configPath } = this.getExecutionContext();

        if (!cwd) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }

        const escapedName = scenarioName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        try {
            // Run bddgen first via execAsync (cross-platform, uses cmd.exe on Windows)
            await execAsync('npx bddgen', { cwd });
        } catch (err: any) {
            vscode.window.showWarningMessage(`bddgen failed: ${err.message}. Running tests anyway...`);
        }

        const terminal = vscode.window.createTerminal({ name: `BDD Run: ${scenarioName}`, cwd });
        terminal.show();
        terminal.sendText(`npx playwright test --config=${configPath} --grep "${escapedName}"`);
    }

    public async debugScenario(scenarioName: string, uri: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found to launch debug session.');
            return;
        }

        const { cwd, configPath } = this.getExecutionContext();
        const escapedName = scenarioName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        try {
            // Always run bddgen before debug
            await execAsync('npx bddgen', { cwd });

            const debugConfig: vscode.DebugConfiguration = {
                type: 'node',
                request: 'launch',
                name: 'Debug Playwright BDD',
                cwd,
                runtimeExecutable: 'npx',
                runtimeArgs: [
                    'playwright',
                    'test',
                    `--config=${configPath}`,
                    '--grep',
                    `"${escapedName}"`
                ],
                env: { PWDEBUG: '1' },
                console: 'internalConsole',
                internalConsoleOptions: 'neverOpen',
                outputCapture: 'std',
                skipFiles: [
                    '<node_internals>/**'
                ]
            };

            const started = await vscode.debug.startDebugging(workspaceFolder, debugConfig);
            if (!started) {
                vscode.window.showErrorMessage('Failed to start debug session.');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Debug failed: ${error.message}`);
        }
    }
}
