import * as vscode from 'vscode';
import { injectable } from 'inversify';

@injectable()
export class FormattingProvider implements vscode.DocumentFormattingEditProvider {
    
    provideDocumentFormattingEdits(
        document: vscode.TextDocument, 
        options: vscode.FormattingOptions, 
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TextEdit[]> {
        const edits: vscode.TextEdit[] = [];
        
        let inTable = false;
        let tableLines: { text: string[], originalLineNum: number }[] = [];
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            
            // Check if line is part of a data table (starts with | after trimming whitespace)
            const isTableLine = text.trim().startsWith('|');

            if (isTableLine) {
                inTable = true;
                // split by pipe, remembering to ignore escaped pipes if needed, 
                // but for simple gherkin, basic split is usually enough for formatting.
                const cells = text.split('|').map(cell => cell.trim());
                tableLines.push({ text: cells, originalLineNum: i });
            } else {
                if (inTable && tableLines.length > 0) {
                    this.formatTableBlock(document, tableLines, edits);
                    inTable = false;
                    tableLines = [];
                }
            }
        }
        
        // Handle EOF if file ends with a table
        if (inTable && tableLines.length > 0) {
            this.formatTableBlock(document, tableLines, edits);
        }

        return edits;
    }

    private formatTableBlock(document: vscode.TextDocument, tableLines: { text: string[], originalLineNum: number }[], edits: vscode.TextEdit[]) {
        // Find max width of each column
        const columnWidths: number[] = [];
        
        // The first and last elements after splitting `| cell | cell |` are empty strings
        for (const row of tableLines) {
            for (let j = 1; j < row.text.length - 1; j++) {
                const cellLen = row.text[j].length;
                if (!columnWidths[j] || cellLen > columnWidths[j]) {
                    columnWidths[j] = cellLen;
                }
            }
        }

        for (const row of tableLines) {
            const originalLine = document.lineAt(row.originalLineNum);
            // preserve original lead whitespace
            const leadingWhitespace = originalLine.text.match(/^\\s*/)?.[0] || '    '; 
            
            let formattedLine = leadingWhitespace + '|';
            for (let j = 1; j < row.text.length - 1; j++) {
                const padding = ' '.repeat(columnWidths[j] - row.text[j].length);
                formattedLine += ` ${row.text[j]}${padding} |`;
            }
            
            // Only create an edit if the line actually changed
            if (formattedLine !== originalLine.text) {
                edits.push(vscode.TextEdit.replace(originalLine.range, formattedLine));
            }
        }
    }
}
