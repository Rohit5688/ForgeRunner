import * as vscode from 'vscode';
import { injectable } from 'inversify';

/**
 * Handles discovery of BDD-related files in the workspace.
 */
@injectable()
export class WorkspaceManager {

    /**
     * Returns the projectRoot prefix for glob patterns, stripped of leading `./` or `/`.
     */
    private getProjectRootPrefix(): string {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const projectRoot = config.get<string>('projectRoot', '');
        if (!projectRoot) return '';
        
        let cleanRoot = projectRoot.replace(/^[\.\/]+/, '');
        return cleanRoot ? `${cleanRoot}/` : '';
    }

    private cleanPath(p: string): string {
        return p.replace(/^[\.\/]+/, '');
    }

    /**
     * Finds all Gherkin .feature files in the current workspace.
     */
    public async findFeatureFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const featureFolder = this.cleanPath(config.get<string>('featureFolder', ''));
        const prefix = this.getProjectRootPrefix();

        let pattern: string;
        if (featureFolder) {
            pattern = `${prefix}${featureFolder}/**/*.feature`;
        } else {
            pattern = `${prefix}**/*.feature`;
        }

        return vscode.workspace.findFiles(pattern, '**/node_modules/**');
    }

    /**
     * Finds all TypeScript/JavaScript files that might contain step definitions.
     */
    public async findStepDefinitionFiles(): Promise<vscode.Uri[]> {
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const stepsFolder = this.cleanPath(config.get<string>('stepsFolder', ''));
        const stepsFilePattern = this.cleanPath(config.get<string>('stepsFilePattern', ''));
        const prefix = this.getProjectRootPrefix();

        let pattern: string;
        
        if (stepsFilePattern) {
            // If the user provided a full pattern like "src/step-definitions/*.{ts,js}", use it directly
            // If they provided just "*.{ts,js}", prepend the folder if it exists
            if (stepsFolder && !stepsFilePattern.includes('/')) {
                pattern = `${prefix}${stepsFolder}/**/${stepsFilePattern}`;
            } else {
                pattern = `${prefix}${stepsFilePattern}`;
            }
        } else if (stepsFolder) {
            pattern = `${prefix}${stepsFolder}/**/*.{ts,js,mjs,mts}`;
        } else {
            pattern = `${prefix}**/*.{ts,js,mjs,mts}`;
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
