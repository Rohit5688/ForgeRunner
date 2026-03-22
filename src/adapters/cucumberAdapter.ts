import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { IBddAdapter } from './adapter.js';
import { TestStateStore } from '../core/testStateStore.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@injectable()
export class CucumberAdapter implements IBddAdapter {
    
    constructor(
        @inject(TYPES.TestStateStore) private testStateStore: TestStateStore
    ) {}

    private getCucumberArgs(request: vscode.TestRunRequest, run: vscode.TestRun): string[] {
        const args: string[] = [];
        if (request.include && request.include.length > 0) {
            const files = new Set<string>();
            const tags = new Set<string>();
            
            for (const item of request.include) {
                if (item.children.size > 0) {
                    files.add(`"${item.uri!.fsPath}"`);
                } else {
                    // It's a Scenario or rule, try to use its tags if any
                    if (item.tags && item.tags.length > 0) {
                        item.tags.forEach(t => tags.add(t.id));
                    }
                    if (item.uri) {
                        files.add(`"${item.uri.fsPath}"`);
                    }
                }
            }

            const tagsArray = Array.from(tags);
            if (tagsArray.length > 0) {
                const tagExpr = tagsArray.join(' or ');
                args.push('--tags');
                args.push(`"${tagExpr}"`);
            }
            Array.from(files).forEach(f => args.push(f));
        }
        return args;
    }

    public async runTests(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken, 
        run: vscode.TestRun,
        controller: vscode.TestController
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            run.appendOutput('No workspace folder found.\\r\\n');
            return;
        }

        try {
            run.appendOutput('Running Standalone Cucumber tests...\\r\\n');
            const args = this.getCucumberArgs(request, run);
            
            const command = `npx cucumber-js -f json:cucumber-report.json ${args.join(' ')}`.trim();
            
            const { stdout, stderr } = await execAsync(command, { cwd: workspaceFolder.uri.fsPath });
            
            if (stderr && !stderr.includes('debugger')) {
                run.appendOutput(`Stderr during execution: ${stderr}\\r\\n`);
            }
            run.appendOutput(`Cucumber output:\\r\\n${stdout}\\r\\n`);

        } catch (error: any) {
            if (error.stdout) {
                run.appendOutput('Cucumber reported test failures:\\r\\n' + error.stdout + '\\r\\n');
            } else {
                run.appendOutput(`Execution failed critically: ${error.message}\\r\\n`);
            }
        } finally {
            run.appendOutput('Test run completed.\\r\\n');
            run.end();
        }
    }

    public async debugTests(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken, 
        run: vscode.TestRun,
        controller: vscode.TestController
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            run.appendOutput('No workspace folder found.\\r\\n');
            return;
        }

        try {
            const args = this.getCucumberArgs(request, run);
            run.appendOutput(`Starting Cucumber Debugger with args: ${args.join(' ')}\\r\\n`);

            const debugConfig: vscode.DebugConfiguration = {
                type: 'node',
                request: 'launch',
                name: 'Debug Standalone Cucumber',
                cwd: workspaceFolder.uri.fsPath,
                runtimeExecutable: 'npx',
                runtimeArgs: [
                    'cucumber-js',
                    ...args
                ],
                console: 'internalConsole',
                internalConsoleOptions: 'neverOpen',
                outputCapture: 'std'
            };

            await vscode.debug.startDebugging(workspaceFolder, debugConfig);
            
            const disposable = vscode.debug.onDidTerminateDebugSession((session) => {
                if (session.name === debugConfig.name) {
                    run.appendOutput('Debug session ended.\\r\\n');
                    run.end();
                    disposable.dispose();
                }
            });

        } catch (error: any) {
            run.appendOutput(`Failed to start debugger: ${error.message}\\r\\n`);
            run.end();
        }
    }
}
