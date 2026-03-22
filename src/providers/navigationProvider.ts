import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { TsParser } from '../parsers/tsParser.js';
import { MatchEngine } from '../core/matcher.js';
import { WorkspaceManager } from '../core/workspaceManager.js';

/**
 * Provides Go-to-Definition and Hover support for BDD features.
 */
@injectable()
export class BddNavigationProvider implements vscode.DefinitionProvider, vscode.HoverProvider {
    constructor(
        @inject(TYPES.GherkinParser) private gherkinParser: GherkinParser,
        @inject(TYPES.TsParser) private tsParser: TsParser,
        @inject(TYPES.MatchEngine) private matchEngine: MatchEngine,
        @inject(TYPES.WorkspaceManager) private workspaceManager: WorkspaceManager
    ) {}

    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        return this.findMatchInWorkspace(document, position);
    }

    public async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const location = await this.findMatchInWorkspace(document, position);
        if (location instanceof vscode.Location) {
            return new vscode.Hover(`**BDD Step Definition**\n\n- File: [${location.uri.fsPath}](${location.uri})\n- Line: ${location.range.start.line + 1}`);
        }
    }

    private async findMatchInWorkspace(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Location | undefined> {
        const line = document.lineAt(position.line).text.trim();
        if (!line) {
            return undefined;
        }

        // Extract the step text (strip keyword)
        const stepText = line.replace(/^(Given|When|Then|And|But|\*)\s+/, '');
        
        // Find all step definitions in the workspace
        const tsFiles = await this.workspaceManager.findStepDefinitionFiles();
        for (const file of tsFiles) {
            const content = await this.workspaceManager.readFile(file);
            const definitions = this.tsParser.parse(file.fsPath, content);
            
            for (const define of definitions) {
                const result = this.matchEngine.match(stepText, define.pattern);
                if (result.isMatch) {
                    return new vscode.Location(
                        vscode.Uri.file(define.uri),
                        new vscode.Range(define.line - 1, 0, define.line - 1, 100)
                    );
                }
            }
        }
        return undefined;
    }
}
