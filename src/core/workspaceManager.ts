import * as vscode from 'vscode';
import { injectable } from 'inversify';

/**
 * Handles discovery of BDD-related files in the workspace.
 */
@injectable()
export class WorkspaceManager {
    /**
     * Finds all Gherkin .feature files in the current workspace.
     */
    public async findFeatureFiles(): Promise<vscode.Uri[]> {
        return vscode.workspace.findFiles('**/*.feature', '**/node_modules/**');
    }

    /**
     * Finds all TypeScript files that might contain step definitions.
     */
    public async findStepDefinitionFiles(): Promise<vscode.Uri[]> {
        return vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
    }

    /**
     * Reads the content of a file URI.
     */
    public async readFile(uri: vscode.Uri): Promise<string> {
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf8');
    }
}
