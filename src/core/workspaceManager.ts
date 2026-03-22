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
        const featureFolder = config.get<string>('featureFolder', '');
        // Only scope to a folder if the user explicitly configured one
        const pattern = featureFolder ? `${featureFolder}/**/*.feature` : '**/*.feature';
        return vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Finds all TypeScript files that might contain step definitions.
     */
    public async findStepDefinitionFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const stepsFolder = config.get<string>('stepsFolder', '');
        const stepsFilePattern = config.get<string>('stepsFilePattern', '');
        
        let pattern: string;
        if (stepsFolder && stepsFilePattern) {
            // Both folder and pattern specified — scope the pattern to the folder
            pattern = `${stepsFolder}/${stepsFilePattern}`;
        } else if (stepsFilePattern) {
            // Only pattern specified — search everywhere
            pattern = stepsFilePattern;
        } else if (stepsFolder) {
            // Only folder specified — find all TS files in that folder
            pattern = `${stepsFolder}/**/*.ts`;
        } else {
            // Nothing configured — broad search (original behavior)
            pattern = '**/*.ts';
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
