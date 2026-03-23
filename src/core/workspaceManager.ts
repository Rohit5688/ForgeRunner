import * as vscode from 'vscode';
import { injectable } from 'inversify';

/**
 * Handles discovery of BDD-related files in the workspace.
 */
@injectable()
export class WorkspaceManager {

    /**
     * Returns the projectRoot prefix for glob patterns.
     * If projectRoot is set (e.g., "my-app"), all search patterns
     * will be scoped under that folder relative to the workspace root.
     */
    private getProjectRootPrefix(): string {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const projectRoot = config.get<string>('projectRoot', '');
        return projectRoot ? `${projectRoot}/` : '';
    }

    /**
     * Finds all Gherkin .feature files in the current workspace.
     */
    public async findFeatureFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const featureFolder = config.get<string>('featureFolder', '');
        const prefix = this.getProjectRootPrefix();

        let pattern: string;
        if (featureFolder) {
            // e.g., "my-app/features/**/*.feature"
            pattern = `${prefix}${featureFolder}/**/*.feature`;
        } else {
            // e.g., "my-app/**/*.feature" or "**/*.feature"
            pattern = `${prefix}**/*.feature`;
        }

        return vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Finds all TypeScript files that might contain step definitions.
     */
    public async findStepDefinitionFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const stepsFolder = config.get<string>('stepsFolder', '');
        const stepsFilePattern = config.get<string>('stepsFilePattern', '');
        const prefix = this.getProjectRootPrefix();

        let pattern: string;
        if (stepsFolder && stepsFilePattern) {
            // Both specified — e.g., "my-app/steps/**/*.steps.{js,ts}"
            pattern = `${prefix}${stepsFolder}/${stepsFilePattern}`;
        } else if (stepsFilePattern) {
            // Only pattern — e.g., "my-app/**/*.steps.{js,ts}"
            pattern = `${prefix}${stepsFilePattern}`;
        } else if (stepsFolder) {
            // Only folder — e.g., "my-app/steps/**/*.ts"
            pattern = `${prefix}${stepsFolder}/**/*.ts`;
        } else {
            // Nothing configured — broad search under projectRoot
            pattern = `${prefix}**/*.ts`;
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
