import * as vscode from 'vscode';

export interface IBddAdapter {
    runTests(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken, 
        run: vscode.TestRun,
        controller: vscode.TestController
    ): Promise<void>;

    debugTests(
        request: vscode.TestRunRequest, 
        token: vscode.CancellationToken, 
        run: vscode.TestRun,
        controller: vscode.TestController
    ): Promise<void>;
}
