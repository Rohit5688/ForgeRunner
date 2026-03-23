import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { WorkspaceManager } from '../core/workspaceManager.js';
import { ExecutionService } from '../services/executionService.js';

@injectable()
export class BddTestController {
    private controller: vscode.TestController;

    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.WorkspaceManager) private workspaceManager: WorkspaceManager,
        @inject(TYPES.ExecutionService) private executionService: ExecutionService,
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {
        this.controller = vscode.tests.createTestController('forge-runner-explorer', 'Forge Runner');
        
        // Create Run Profile
        this.controller.createRunProfile(
            'Run BDD Tests',
            vscode.TestRunProfileKind.Run,
            async (request, token) => {
                await this.executionService.run(request, token, this.controller);
            },
            true
        );

        // Create Debug Profile
        this.controller.createRunProfile(
            'Debug BDD Tests',
            vscode.TestRunProfileKind.Debug,
            async (request, token) => {
                await this.executionService.debug(request, token, this.controller);
            },
            false
        );
        
        // Handle lazy loading of test children
        this.controller.resolveHandler = async (item) => {
            if (!item) {
                await this.discoverAllTests();
            }
        };

        // Watch for file changes
        vscode.workspace.onDidSaveTextDocument(async (doc) => {
            if (doc.fileName.endsWith('.feature')) {
                await this.refreshFile(doc.uri);
            }
        });

        // Eagerly parse instantly when a user opens a file to populate Gutter icons immediately 
        vscode.workspace.onDidOpenTextDocument(async (doc) => {
            if (doc.fileName.endsWith('.feature')) {
                await this.refreshFile(doc.uri);
            }
        });

        // Initialize already open files if any exist on startup
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.fileName.endsWith('.feature')) {
                this.refreshFile(doc.uri).catch(() => {});
            }
        }
    }

    public get nativeController(): vscode.TestController {
        return this.controller;
    }

    // ── Public API for CodeLens / external callers ───────────────────────

    /**
     * Run a single scenario by name from any entry point (CodeLens, command palette, etc.).
     * Routes through the TestController pipeline so Testing View + Test Results stay in sync.
     */
    public async runByScenarioName(scenarioName: string, fileUri: string): Promise<void> {
        const testItem = await this.ensureAndFindTestItem(scenarioName, fileUri);
        if (!testItem) {
            vscode.window.showWarningMessage(`Could not find scenario "${scenarioName}" in the test tree. Running via terminal fallback.`);
            return;
        }

        const request = new vscode.TestRunRequest([testItem]);
        const token = new vscode.CancellationTokenSource().token;
        await this.executionService.run(request, token, this.controller);
    }

    /**
     * Debug a single scenario by name from any entry point.
     * Routes through the TestController pipeline.
     */
    public async debugByScenarioName(scenarioName: string, fileUri: string): Promise<void> {
        const testItem = await this.ensureAndFindTestItem(scenarioName, fileUri);
        if (!testItem) {
            vscode.window.showWarningMessage(`Could not find scenario "${scenarioName}" in the test tree. Cannot start debug.`);
            return;
        }

        const request = new vscode.TestRunRequest([testItem]);
        const token = new vscode.CancellationTokenSource().token;
        await this.executionService.debug(request, token, this.controller);
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /**
     * Ensures the file is parsed/discovered, then searches for the test item.
     */
    private async ensureAndFindTestItem(scenarioName: string, fileUri: string): Promise<vscode.TestItem | undefined> {
        const uri = vscode.Uri.file(fileUri);

        // Ensure the feature file is parsed and its scenarios are in the tree
        if (!this.controller.items.get(uri.fsPath)) {
            await this.refreshFile(uri);
        }

        return this.findTestItem(scenarioName, uri.fsPath);
    }

    /**
     * Find a TestItem by scenario name under a specific feature file.
     */
    private findTestItem(scenarioName: string, filePath: string): vscode.TestItem | undefined {
        const featureItem = this.controller.items.get(filePath);
        if (!featureItem) {
            return undefined;
        }

        let found: vscode.TestItem | undefined;
        featureItem.children.forEach(child => {
            if (!found && child.label === scenarioName) {
                found = child;
            }
        });

        // Fallback: partial match (for scenario outlines that may have additional text)
        if (!found) {
            featureItem.children.forEach(child => {
                if (!found && (child.label.includes(scenarioName) || scenarioName.includes(child.label))) {
                    found = child;
                }
            });
        }

        return found;
    }

    private async discoverAllTests() {
        this.logger.appendLine('[Discovery] Starting full workspace scan...');
        try {
            const files = await this.workspaceManager.findFeatureFiles();
            this.logger.appendLine(`[Discovery] Found ${files.length} feature files.`);
            
            for (const file of files) {
                await this.refreshFile(file);
            }
        } catch (error: any) {
            this.logger.appendLine(`[Discovery] Error during scan: ${error.message}`);
        }
    }

    private async refreshFile(uri: vscode.Uri) {
        this.logger.appendLine(`[Parser] Processing: ${uri.fsPath}`);
        try {
            const content = await this.workspaceManager.readFile(uri);
            const feature = await this.gherkinParser.parse(uri.fsPath, content);
            
            this.logger.appendLine(`[Parser] Success: "${feature.name}" (${feature.scenarios.length} scenarios)`);
            
            const featureItem = this.getOrCreateFeatureItem(uri, feature.name);
            featureItem.children.replace([]);
            
            // Map Feature-level tags
            if (feature.tags && feature.tags.length > 0) {
                featureItem.tags = feature.tags.map(t => new vscode.TestTag(t));
            }

            for (const scenario of feature.scenarios) {
                const scenarioItem = this.controller.createTestItem(
                    scenario.id,
                    scenario.name,
                    uri
                );
                
                // Map Scenario-level tags
                if (scenario.tags && scenario.tags.length > 0) {
                    scenarioItem.tags = scenario.tags.map(t => new vscode.TestTag(t));
                }

                scenarioItem.range = new vscode.Range(
                    new vscode.Position(scenario.line - 1, 0),
                    new vscode.Position(scenario.line - 1, 100)
                );
                featureItem.children.add(scenarioItem);
            }
        } catch (e: any) {
            this.logger.appendLine(`[Parser] Failed ${uri.fsPath}: ${e.message}`);
        }
    }

    private getOrCreateFeatureItem(uri: vscode.Uri, name: string): vscode.TestItem {
        const existing = this.controller.items.get(uri.fsPath);
        if (existing) {
            return existing;
        }

        const item = this.controller.createTestItem(uri.fsPath, name || uri.fsPath, uri);
        
        // Ensure the root feature item has a basic range so gutter icons appear at the top of the file
        item.range = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(0, 100)
        );

        this.controller.items.add(item);
        return item;
    }

    public dispose() {
        this.controller.dispose();
    }
}
