import * as ts from 'typescript';
import { injectable } from 'inversify';

export interface StepDefinition {
    pattern: string;
    line: number;
    column: number;
    uri: string;
    keyword: string;
}

@injectable()
export class TsParser {
    private readonly BDD_KEYWORDS = new Set(['Given', 'When', 'Then', 'And', 'But', 'Step']);

    /**
     * Parses a TypeScript file to find all BDD step definitions.
     * Uses TS Compiler API for high-precision extraction (replaces legacy regex).
     */
    public parse(uri: string, content: string): StepDefinition[] {
        const sourceFile = ts.createSourceFile(uri, content, ts.ScriptTarget.Latest, true);
        const definitions: StepDefinition[] = [];

        const visitor = (node: ts.Node) => {
            if (ts.isCallExpression(node)) {
                const expression = node.expression;
                let keyword = '';

                if (ts.isIdentifier(expression) && this.BDD_KEYWORDS.has(expression.text)) {
                    keyword = expression.text;
                } else if (ts.isPropertyAccessExpression(expression) && 
                           ts.isIdentifier(expression.name) && 
                           this.BDD_KEYWORDS.has(expression.name.text)) {
                    // Support for bdd.Given(...) or similar
                    keyword = expression.name.text;
                }

                if (keyword && node.arguments.length > 0) {
                    const patternArg = node.arguments[0];
                    let pattern = '';

                    if (ts.isStringLiteral(patternArg) || ts.isNoSubstitutionTemplateLiteral(patternArg)) {
                        pattern = patternArg.text;
                    } else if (ts.isRegularExpressionLiteral(patternArg)) {
                        pattern = patternArg.text;
                    }

                    if (pattern) {
                        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                        definitions.push({
                            pattern,
                            keyword,
                            line: line + 1,
                            column: character + 1,
                            uri
                        });
                    }
                }
            }
            ts.forEachChild(node, visitor);
        };

        visitor(sourceFile);
        return definitions;
    }

    /**
     * Helper for tests or quick scans - parses raw content without caring about the URI.
     */
    public parseContent(content: string): string[] {
        const definitions = this.parse('temp.ts', content);
        return definitions.map(d => d.pattern);
    }
}
