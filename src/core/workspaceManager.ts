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
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const featureFolder = config.get<string>('featureFolder', 'features');
        // If featureFolder is provided, search only within it
        const pattern = featureFolder ? `${featureFolder}/**/*.feature` : '**/*.feature';
        return vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Finds all TypeScript files that might contain step definitions.
     */
    public async findStepDefinitionFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const stepsFolder = config.get<string>('stepsFolder', 'steps');
        const stepsFilePattern = config.get<string>('stepsFilePattern', '**/*.steps.{js,ts}');
        
        let pattern = stepsFilePattern;
        if (stepsFolder) {
            pattern = `${stepsFolder}/${stepsFilePattern}`;
        }
        
        return vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Reads the content of a file URI.
     */
    public async readFile(uri: vscode.Uri): Promise<string> {
        const data = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(data).toString('utf8');
    }
}
