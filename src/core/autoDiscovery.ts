import * as vscode from 'vscode';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { TYPES } from './types.js';

@injectable()
export class AutoDiscoveryService {
    constructor(
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {}

    /**
     * Entry point for running discovery on extension activation.
     */
    public async run(): Promise<void> {
        this.logger.appendLine('[AutoDiscovery] Starting workspace scan...');

        // 1. Check if we should even run (are they using defaults?)
        const config = vscode.workspace.getConfiguration('forge-runner.playwright');
        const projectRoot = config.get<string>('projectRoot', '');
        const featureFolder = config.get<string>('featureFolder', '');
        const stepsFolder = config.get<string>('stepsFolder', '');
        
        // If any of these are customized, we abort to prevent overwriting user intent
        if (projectRoot !== '' || featureFolder !== '' || stepsFolder !== '') {
            this.logger.appendLine('[AutoDiscovery] Aborted: User has custom configuration in settings.');
            return;
        }

        // 2. Discover Playwright Config files
        const configFiles = await vscode.workspace.findFiles('**/playwright.config.{ts,js,mts,mjs,cts,cjs}', '**/node_modules/**');
        
        if (configFiles.length === 0) {
            this.logger.appendLine('[AutoDiscovery] Aborted: No Playwright configuration files found in workspace.');
            return;
        }

        if (configFiles.length > 1) {
            this.logger.appendLine(`[AutoDiscovery] Aborted: Found ${configFiles.length} config files. Monorepo detected.`);
            vscode.window.showInformationMessage(
                'Forge Runner detected multiple Playwright projects. Please manually configure "forge-runner.playwright.projectRoot" in your Workspace Settings.',
                'Open Settings'
            ).then(choice => {
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', 'forge-runner.playwright');
                }
            });
            return;
        }

        // We have exactly one config file!
        const configUri = configFiles[0];
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(configUri);
        
        if (!workspaceFolder) {
            this.logger.appendLine('[AutoDiscovery] Aborted: Config file is not within a known workspace folder.');
            return;
        }

        const relativeConfigDir = path.dirname(vscode.workspace.asRelativePath(configUri, false));
        // If the config is at the root of the workspace folder, projectRoot is '' (or './').
        // Since getConfiguration default is '', we use '' for root.
        const newProjectRoot = relativeConfigDir === '.' ? '' : relativeConfigDir;

        this.logger.appendLine(`[AutoDiscovery] Detected projectRoot: "${newProjectRoot}"`);

        // 3. Discover Feature Files under projectRoot
        const featurePattern = newProjectRoot ? `${newProjectRoot}/**/*.feature` : '**/*.feature';
        const featureFiles = await vscode.workspace.findFiles(featurePattern, '**/node_modules/**');
        let newFeatureFolder = '';
        
        if (featureFiles.length > 0) {
            const featureDirs = new Map<string, number>();
            for (const file of featureFiles) {
                // Get path relative to projectRoot
                let relPath = vscode.workspace.asRelativePath(file, false);
                if (newProjectRoot && relPath.startsWith(newProjectRoot + '/')) {
                    relPath = relPath.slice(newProjectRoot.length + 1);
                }
                const dir = path.dirname(relPath);
                featureDirs.set(dir, (featureDirs.get(dir) || 0) + 1);
            }

            // Find the directory with the most feature files
            let maxCount = 0;
            for (const [dir, count] of featureDirs.entries()) {
                if (count > maxCount) {
                    maxCount = count;
                    newFeatureFolder = dir;
                }
            }
            // Normalize path (e.g. '.' becomes '')
            newFeatureFolder = newFeatureFolder === '.' ? '' : newFeatureFolder;
            this.logger.appendLine(`[AutoDiscovery] Detected featureFolder: "${newFeatureFolder}" (${maxCount} files)`);
        }

        // 4. Discover Step Definition Files under projectRoot
        const tsjsPattern = newProjectRoot ? `${newProjectRoot}/**/*.{ts,js,mts,mjs}` : '**/*.{ts,js,mts,mjs}';
        const tsjsFiles = await vscode.workspace.findFiles(tsjsPattern, '**/node_modules/**');
        let newStepsFolder = '';

        if (tsjsFiles.length > 0) {
            const stepDirs = new Map<string, number>();
            const stepRegex = /\b(Given|When|Then|And|But)\s*\(|playwright-bdd|@cucumber/i;

            for (const file of tsjsFiles) {
                try {
                    const contentBytes = await vscode.workspace.fs.readFile(file);
                    const content = contentBytes.toString();
                    if (stepRegex.test(content)) {
                        let relPath = vscode.workspace.asRelativePath(file, false);
                        if (newProjectRoot && relPath.startsWith(newProjectRoot + '/')) {
                            relPath = relPath.slice(newProjectRoot.length + 1);
                        }
                        const dir = path.dirname(relPath);
                        stepDirs.set(dir, (stepDirs.get(dir) || 0) + 1);
                    }
                } catch (e) {
                    // Ignore read errors
                }
            }

            let maxStepCount = 0;
            for (const [dir, count] of stepDirs.entries()) {
                if (count > maxStepCount) {
                    maxStepCount = count;
                    newStepsFolder = dir;
                }
            }
            newStepsFolder = newStepsFolder === '.' ? '' : newStepsFolder;
            if (maxStepCount > 0) {
                this.logger.appendLine(`[AutoDiscovery] Detected stepsFolder: "${newStepsFolder}" (${maxStepCount} files)`);
            }
        }

        // 5. Apply configurations non-destructively
        try {
            if (newProjectRoot) {
                await config.update('projectRoot', newProjectRoot, vscode.ConfigurationTarget.Workspace);
            }
            if (newFeatureFolder) {
                await config.update('featureFolder', newFeatureFolder, vscode.ConfigurationTarget.Workspace);
            }
            if (newStepsFolder) {
                await config.update('stepsFolder', newStepsFolder, vscode.ConfigurationTarget.Workspace);
            }

            const updatesMade = Boolean(newProjectRoot || newFeatureFolder || newStepsFolder);
            if (updatesMade) {
                vscode.window.showInformationMessage(
                    'Forge Runner automatically detected and applied your Playwright BDD project configuration.'
                );
            }
        } catch (e) {
            this.logger.appendLine(`[AutoDiscovery] Failed to update workspace settings: ${e}`);
        }
    }
}
