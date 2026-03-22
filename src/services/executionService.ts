import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { PlaywrightBddAdapter } from '../adapters/playwrightBddAdapter.js';
import { CucumberAdapter } from '../adapters/cucumberAdapter.js';

@injectable()
export class ExecutionService {
    constructor(
        @inject(TYPES.PlaywrightBddAdapter) private playwrightAdapter: PlaywrightBddAdapter,
        @inject(TYPES.CucumberAdapter) private cucumberAdapter: CucumberAdapter
    ) {}

    private getActiveAdapter() {
        const config = vscode.workspace.getConfiguration('forge-runner');
        const framework = config.get<string>('testing.framework', 'playwright-bdd');
        if (framework === 'cucumber') {
            return this.cucumberAdapter;
        }
        return this.playwrightAdapter;
    }

    /**
     * Entry point for running tests from the Test Explorer.
     */
    public async run(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken,
        controller: vscode.TestController
    ) {
        const run = controller.createTestRun(request);
        const adapter = this.getActiveAdapter();
        await adapter.runTests(request, token, run, controller);
    }

    /**
     * Entry point for step-by-step debugging.
     */
    public async debug(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken,
        controller: vscode.TestController
    ) {
        const run = controller.createTestRun(request, 'Debug BDD', false);
        const adapter = this.getActiveAdapter();
        await adapter.debugTests(request, token, run, controller);
    }
}
