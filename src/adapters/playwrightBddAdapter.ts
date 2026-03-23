import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { IBddAdapter } from './adapter.js';
import { TestStateStore } from '../core/testStateStore.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const MAX_BUFFER = 10 * 1024 * 1024;

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
                    const escapedGreps = grepsArray.map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    args.push('--grep');
                    args.push(`"${escapedGreps.join('|')}"`);
                }
            }
            Array.from(files).forEach(f => args.push(f));
        }
        return args;
    }

    /**
     * Collect all TestItems that are part of this run (for lifecycle tracking).
     */
    private collectIncludedItems(request: vscode.TestRunRequest, controller: vscode.TestController): vscode.TestItem[] {
        const items: vscode.TestItem[] = [];
        if (request.include && request.include.length > 0) {
            for (const item of request.include) {
                if (item.children.size > 0) {
                    // Feature-level: include all children
                    item.children.forEach(child => items.push(child));
                } else {
                    items.push(item);
                }
            }
        } else {
            // Running all: collect every scenario
            controller.items.forEach(featureItem => {
                featureItem.children.forEach(child => items.push(child));
            });
        }
        return items;
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
        
        const executionDir = projectRootRelative 
            ? path.join(workspaceFolder.uri.fsPath, projectRootRelative) 
            : workspaceFolder.uri.fsPath;

        // Mark all included items as "started" (shows spinner in Testing View)
        const includedItems = this.collectIncludedItems(request, controller);
        for (const item of includedItems) {
            run.started(item);
        }

        // Track which items received a result (for fallback marking)
        const reportedItemIds = new Set<string>();

        try {
            run.appendOutput(`Generating BDD files in ${executionDir} (npx bddgen)...\r\n`);
            await execAsync('npx bddgen', { cwd: executionDir, maxBuffer: MAX_BUFFER });

            run.appendOutput('Running Playwright tests...\r\n');
            
            const args = this.getRunArgs(request, run);
            
            // Write JSON results to a temp file so we don't need to pass --reporter=json
            // This preserves the user's configured reporters (HTML, headed mode, etc.)
            const jsonOutputFile = path.join(os.tmpdir(), `forge-results-${Date.now()}.json`);
            
            // Don't pass --reporter on CLI — let the user's playwright.config.ts handle it
            const command = `npx playwright test --config=${configPath} ${args.join(' ')}`.trim();
            
            run.appendOutput(`Executing: ${command}\r\n`);
            
            let exitCode = 0;
            let stdout = '';
            let stderr = '';
            
            try {
                const result = await execAsync(command, {
                    cwd: executionDir,
                    maxBuffer: MAX_BUFFER,
                    env: {
                        ...process.env,
                        // Tell Playwright's JSON reporter (if configured) to write to our temp file
                        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOutputFile
                    }
                });
                stdout = result.stdout;
                stderr = result.stderr;
            } catch (execError: any) {
                exitCode = execError.code || 1;
                stdout = execError.stdout || '';
                stderr = execError.stderr || '';
                run.appendOutput(`Test run exited with code ${exitCode}.\r\n`);
                if (stderr) {
                    run.appendOutput(`Error output:\r\n${stderr}\r\n`);
                }
                if (stdout) {
                    run.appendOutput(`Test output:\r\n${stdout}\r\n`);
                }
            }
            
            // Try to parse results from the JSON temp file first
            let jsonParsed = false;
            try {
                if (fs.existsSync(jsonOutputFile)) {
                    const jsonContent = fs.readFileSync(jsonOutputFile, 'utf8');
                    this.reportResultsFromJson(jsonContent, run, controller, reportedItemIds);
                    jsonParsed = true;
                    fs.unlinkSync(jsonOutputFile); // Clean up
                }
            } catch (parseErr: any) {
                run.appendOutput(`Could not parse JSON results file: ${parseErr.message}\r\n`);
            }
            
            // Fallback: if no JSON file was available, mark based on exit code
            if (!jsonParsed) {
                if (exitCode === 0) {
                    for (const item of includedItems) {
                        if (!reportedItemIds.has(item.id)) {
                            reportedItemIds.add(item.id);
                            this.testStateStore.recordSuccess(item.id);
                            run.passed(item);
                        }
                    }
                } else {
                    const errorDetail = stderr || stdout || 'Tests failed — check terminal output for details.';
                    for (const item of includedItems) {
                        if (!reportedItemIds.has(item.id)) {
                            reportedItemIds.add(item.id);
                            this.testStateStore.recordFailure(item.id, errorDetail);
                            run.failed(item, new vscode.TestMessage(errorDetail));
                        }
                    }
                }
            }

        } catch (error: any) {
            run.appendOutput(`Execution failed critically: ${error.message}\r\n`);
        } finally {
            // Mark any included items that didn't get a result as "errored"
            for (const item of includedItems) {
                if (!reportedItemIds.has(item.id)) {
                    run.errored(item, new vscode.TestMessage('Test result not captured — check Forge Runner output for details.'));
                }
            }
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
        
        const executionDir = projectRootRelative 
            ? path.join(workspaceFolder.uri.fsPath, projectRootRelative) 
            : workspaceFolder.uri.fsPath;

        // Mark all included items as "started"
        const includedItems = this.collectIncludedItems(request, controller);
        for (const item of includedItems) {
            run.started(item);
        }

        try {
            run.appendOutput(`Generating BDD files for Debug in ${executionDir} (npx bddgen)...\r\n`);
            await execAsync('npx bddgen', { cwd: executionDir, maxBuffer: MAX_BUFFER });

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
                    PWDEBUG: '1'
                },
                console: 'internalConsole',
                internalConsoleOptions: 'neverOpen',
                outputCapture: 'std',
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

    private reportResultsFromJson(jsonString: string, run: vscode.TestRun, controller: vscode.TestController, reportedItemIds: Set<string>) {
        try {
            // Sometimes JSON has non-json prefix logs
            const jsonStartOffset = jsonString.indexOf('{');
            const cleanJson = jsonStartOffset > -1 ? jsonString.substring(jsonStartOffset) : jsonString;
            const results = JSON.parse(cleanJson);
            
            for (const suite of results.suites || []) {
                this.processSuite(suite, run, controller, null, reportedItemIds);
            }
        } catch (e: any) {
            run.appendOutput(`Failed to parse test results JSON: ${e.message}\r\n`);
        }
    }

    private processSuite(suite: any, run: vscode.TestRun, controller: vscode.TestController, parentFeatureItem: vscode.TestItem | null, reportedItemIds: Set<string>) {
        let currentFeatureItem = parentFeatureItem;
        if (!currentFeatureItem) {
            // Match by suite title against feature label
            controller.items.forEach(item => {
                if (suite.title && item.label && suite.title.includes(item.label)) {
                    currentFeatureItem = item;
                }
            });

            // Fallback: match by file path if the suite has a file property
            if (!currentFeatureItem && suite.file) {
                controller.items.forEach(item => {
                    if (item.uri && item.uri.fsPath.endsWith(suite.file)) {
                        currentFeatureItem = item;
                    }
                });
            }
        }

        // Process actual tests (Scenarios)
        for (const test of suite.tests || []) {
            let scenarioItem: vscode.TestItem | undefined = undefined;

            if (currentFeatureItem) {
                // Exact match first
                currentFeatureItem.children.forEach(child => {
                    if (!scenarioItem && child.label === test.title) {
                        scenarioItem = child;
                    }
                });
                // Partial match fallback
                if (!scenarioItem) {
                    currentFeatureItem.children.forEach(child => {
                        if (!scenarioItem && (test.title.includes(child.label) || child.label.includes(test.title))) {
                            scenarioItem = child;
                        }
                    });
                }
            } else {
                // Global fallback: search the entire tree
                scenarioItem = this.findTestItemByLabel(controller.items, test.title);
            }

            if (scenarioItem) {
                const testResult = test.results?.[0];
                if (testResult) {
                    const duration = testResult.duration || 0;
                    reportedItemIds.add(scenarioItem.id);
                    if (testResult.status === 'passed' || testResult.status === 'expected') {
                        this.testStateStore.recordSuccess(scenarioItem.id);
                        run.passed(scenarioItem, duration);
                    } else if (testResult.status === 'failed' || testResult.status === 'unexpected') {
                        const errorMsg = testResult.error?.message || testResult.error?.snippet || 'Test failed';
                        this.testStateStore.recordFailure(scenarioItem.id, errorMsg);
                        run.failed(scenarioItem, new vscode.TestMessage(errorMsg), duration);
                    } else if (testResult.status === 'skipped') {
                        reportedItemIds.add(scenarioItem.id);
                        run.skipped(scenarioItem);
                    }
                }
            } else {
                run.appendOutput(`Could not map Playwright test "${test.title}" back to VS Code UI.\r\n`);
            }
        }

        // Recurse into sub-suites
        for (const subSuite of suite.suites || []) {
            this.processSuite(subSuite, run, controller, currentFeatureItem, reportedItemIds);
        }
    }

    private findTestItemByLabel(collection: vscode.TestItemCollection, label: string): vscode.TestItem | undefined {
        let found: vscode.TestItem | undefined = undefined;
        collection.forEach((item) => {
            if (found) {
                return;
            }
            if (item.label === label) {
                found = item;
            } else if (label.includes(item.label) || item.label.includes(label)) {
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

