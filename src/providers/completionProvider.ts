import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { TsParser } from '../parsers/tsParser.js';
import { WorkspaceManager } from '../core/workspaceManager.js';

@injectable()
export class BddCompletionProvider implements vscode.CompletionItemProvider {
    constructor(
        @inject(TYPES.TsParser) private tsParser: TsParser,
        @inject(TYPES.WorkspaceManager) private workspaceManager: WorkspaceManager
    ) {}

    public async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
        const lineText = document.lineAt(position.line).text;
        const lineUntilCursor = lineText.substring(0, position.character);

        // Only trigger after BDD keywords
        const keywordMatch = lineUntilCursor.match(/^(?:Given|When|Then|And|But)\s+/i);
        if (!keywordMatch) {
            return [];
        }

        // Search workspace for step definitions
        const tsFiles = await this.workspaceManager.findStepDefinitionFiles();
        const allSteps = [];

        for (const uri of tsFiles) {
            const content = await this.workspaceManager.readFile(uri);
            const steps = this.tsParser.parse(uri.fsPath, content);
            allSteps.push(...steps);
        }

        // De-duplicate patterns
        const uniquePatterns = Array.from(new Set(allSteps.map(s => s.pattern)));

        return uniquePatterns.map(pattern => {
            const item = new vscode.CompletionItem(pattern, vscode.CompletionItemKind.Snippet);
            item.detail = 'BDD Step Definition';
            item.documentation = new vscode.MarkdownString(`Matches step definition in workspace.`);
            
            // Convert Cucumber Expression params {string} to snippets ${1:string}
            const snippet = pattern.replace(/{([^}]+)}/g, (match, p1, offset, string) => {
                return `\${${match.length}:${p1}}`; // Simplistic snippet conversion
            });
            item.insertText = new vscode.SnippetString(snippet);
            
            return item;
        });
    }
}
