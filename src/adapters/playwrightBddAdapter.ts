import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { IBddAdapter } from './adapter.js';
import { TestStateStore } from '../core/testStateStore.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@injectable()
export class PlaywrightBddAdapter implements IBddAdapter {
    constructor(
        @inject(TYPES.TestStateStore) private testStateStore: TestStateStore
    ) {}

    private getRunArgs(request: vscode.TestRunRequest, run: vscode.TestRun): string[] {
        const args: string[] = [];
        if (request.include && request.include.length > 0) {
            const files = new Set<string>();
            const greps = new Set<string>();
            
            for (const item of request.include) {
                if (item.children.size > 0) {
                    files.add(`"${item.uri!.fsPath}"`);
                } else {
                    greps.add(item.label);
                    // Ensure we explicitly test this file
                    if (item.uri) {
                        files.add(`"${item.uri.fsPath}"`);
                    }
                }
            }

            const grepsArray = Array.from(greps);
            
            if (grepsArray.length > 0) {
                // Prevent OS CLI string limit overflow
                if (grepsArray.length > 30) {
                    run.appendOutput(`Warning: Executing large number of specific items (${grepsArray.length}). Running parent features completely.\r\n`);
                } else {
                    // Playwright uses JS Regex for --grep
                    // Escape regex chars in labels to be safe
                    const escapedGreps = grepsArray.map(g => g.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&'));
                    args.push('--grep');
                    args.push(`"${escapedGreps.join('|')}"`);
                }
            }
            Array.from(files).forEach(f => args.push(f));
        }
        return args;
    }

    /**
     * Executes Playwright-BDD tests and reports results via the VS Code Test API.
     */
    public async runTests(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken, 
        run: vscode.TestRun,
        controller: vscode.TestController
    ): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            run.appendOutput('No workspace folder found.\r\n');
            return;
        }

        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const configPath = config.get<string>('configPath', 'playwright.config.ts');
        const projectRootRelative = config.get<string>('projectRoot', '');
        
        const path = require('path');
        const executionDir = projectRootRelative 
            ? path.join(workspaceFolder.uri.fsPath, projectRootRelative) 
            : workspaceFolder.uri.fsPath;

        try {
            run.appendOutput(`Generating BDD files in ${executionDir} (npx bddgen)...\r\n`);
            // Always run bddgen before tests
            await execAsync('npx bddgen', { cwd: executionDir });

            run.appendOutput('Running Playwright tests...\r\n');
            
            const args = this.getRunArgs(request, run);
            
            // Build command with config path if provided
            const command = `npx playwright test --config=${configPath} --reporter=json ${args.join(' ')}`.trim();
            
            run.appendOutput(`Executing: ${command}\r\n`);
            const { stdout, stderr } = await execAsync(command, { cwd: executionDir });
            
            if (stderr) {
                run.appendOutput(`Stderr during execution: ${stderr}\r\n`);
            }
            this.reportResults(stdout, request, run, controller);

        } catch (error: any) {
            if (error.stdout) {
                run.appendOutput('Playwright reported test failures.\r\n');
                this.reportResults(error.stdout, request, run, controller);
            } else {
                run.appendOutput(`Execution failed critically: ${error.message}\r\n`);
            }
        } finally {
            run.appendOutput('Test run completed.\r\n');
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
            run.appendOutput('No workspace folder found.\r\n');
            return;
        }

        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const configPath = config.get<string>('configPath', 'playwright.config.ts');
        const projectRootRelative = config.get<string>('projectRoot', '');
        
        const path = require('path');
        const executionDir = projectRootRelative 
            ? path.join(workspaceFolder.uri.fsPath, projectRootRelative) 
            : workspaceFolder.uri.fsPath;

        try {
            run.appendOutput(`Generating BDD files for Debug in ${executionDir} (npx bddgen)...\r\n`);
            await execAsync('npx bddgen', { cwd: executionDir });

            const args = this.getRunArgs(request, run);
            run.appendOutput(`Starting Playwright Debugger with args: ${args.join(' ')}\r\n`);

            const debugConfig: vscode.DebugConfiguration = {
                type: 'node',
                request: 'launch',
                name: 'Debug Playwright BDD',
                cwd: executionDir,
                runtimeExecutable: 'npx',
                runtimeArgs: [
                    'playwright',
                    'test',
                    `--config=${configPath}`,
                    ...args
                ],
                env: {
                    PWDEBUG: '1' // '1' is the standard for triggering Playwright Inspector and breakpoints
                },
                console: 'internalConsole',
                internalConsoleOptions: 'neverOpen',
                outputCapture: 'std',
                // Important for debugger attachment
                skipFiles: [
                    '<node_internals>/**'
                ]
            };

            const started = await vscode.debug.startDebugging(workspaceFolder, debugConfig);
            if (!started) {
                throw new Error('Failed to start debug session.');
            }
            
            const disposable = vscode.debug.onDidTerminateDebugSession((session) => {
                if (session.name === debugConfig.name) {
                    run.appendOutput('Debug session ended.\r\n');
                    run.end();
                    disposable.dispose();
                }
            });

        } catch (error: any) {
            run.appendOutput(`Failed to start debugger: ${error.message}\r\n`);
            run.end();
        }
    }

    private reportResults(stdout: string, request: vscode.TestRunRequest, run: vscode.TestRun, controller: vscode.TestController) {
        try {
            // Sometimes stdout has non-json prefix logs from 'playwright test'
            const jsonStartOffset = stdout.indexOf('{');
            const jsonString = jsonStartOffset > -1 ? stdout.substring(jsonStartOffset) : stdout;
            const results = JSON.parse(jsonString);
            
            for (const suite of results.suites || []) {
                this.processSuite(suite, run, controller, null);
            }
        } catch (e: any) {
            run.appendOutput(`Failed to parse test results JSON: ${e.message}\\r\\n`);
        }
    }

    private processSuite(suite: any, run: vscode.TestRun, controller: vscode.TestController, parentFeatureItem: vscode.TestItem | null) {
        // Try to identify if this suite represents a Feature file in our Controller
        let currentFeatureItem = parentFeatureItem;
        if (!currentFeatureItem) {
            // Search all top-level items (Features) to see if this suite title matches the Feature name
            controller.items.forEach(item => {
                if (suite.title && item.label && suite.title.includes(item.label)) {
                    currentFeatureItem = item;
                }
            });
        }

        // Process actual tests (Scenarios)
        for (const test of suite.tests || []) {
            let scenarioItem: vscode.TestItem | undefined = undefined;

            if (currentFeatureItem) {
                // Look for the scenario inside the matched feature
                currentFeatureItem.children.forEach(child => {
                    if (test.title.includes(child.label)) {
                        scenarioItem = child;
                    }
                });
            } else {
                // Global fallback: just search the entire tree for a matching scenario name
                scenarioItem = this.findTestItemByLabel(controller.items, test.title);
            }

            if (scenarioItem) {
                // Extract result
                const testResult = test.results?.[0]; // Get the first run attempt
                if (testResult) {
                    const duration = testResult.duration || 0;
                    if (testResult.status === 'passed' || testResult.status === 'expected') {
                        this.testStateStore.recordSuccess(scenarioItem.id);
                        run.passed(scenarioItem, duration);
                    } else if (testResult.status === 'failed' || testResult.status === 'unexpected') {
                        const errorMsg = testResult.error?.message || testResult.error?.snippet || 'Test failed';
                        this.testStateStore.recordFailure(scenarioItem.id, errorMsg);
                        run.failed(scenarioItem, new vscode.TestMessage(errorMsg), duration);
                    } else if (testResult.status === 'skipped') {
                        run.skipped(scenarioItem);
                    }
                }
            } else {
                run.appendOutput(`Could not map Playwright test "${test.title}" back to VS Code UI.\\r\\n`);
            }
        }

        // Recurse into sub-suites
        for (const subSuite of suite.suites || []) {
            this.processSuite(subSuite, run, controller, currentFeatureItem);
        }
    }

    private findTestItemByLabel(collection: vscode.TestItemCollection, label: string): vscode.TestItem | undefined {
        let found: vscode.TestItem | undefined = undefined;
        collection.forEach((item) => {
            if (found) {
                return;
            }
            if (label.includes(item.label)) {
                found = item;
            } else if (item.children.size > 0) {
                const childFound = this.findTestItemByLabel(item.children, label);
                if (childFound) {
                    found = childFound;
                }
            }
        });
        return found;
    }
}
