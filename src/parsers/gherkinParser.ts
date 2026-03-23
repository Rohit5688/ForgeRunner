import { 
    generateMessages, 
    IGherkinOptions 
} from '@cucumber/gherkin';
import { 
    Envelope, 
    GherkinDocument, 
    Feature, 
    Scenario, 
    Step, 
    Pickle 
} from '@cucumber/messages';
import { injectable } from 'inversify';

/**
 * Internal models for the Forge Runner
 */
export interface GherkinStep {
    keyword: string;
    text: string;
    line: number;
    column: number;
}

export interface GherkinScenario {
    id: string;
    name: string;
    steps: GherkinStep[];
    line: number;
    outlineLine?: number;
    tags: string[];
}

export interface GherkinFeature {
    uri: string;
    name: string;
    scenarios: GherkinScenario[];
    tags: string[];
}

@injectable()
export class GherkinParser {
    /**
     * Parses a .feature file content into a high-level Feature model.
     * Use AST parsing to ensure precision (replaces legacy regex).
     */
    public async parse(uri: string, content: string): Promise<GherkinFeature> {
        const envelopes = await this.getEnvelopes(uri, content);
        
        const gherkinDocument = envelopes.find(e => e.gherkinDocument)?.gherkinDocument;
        const pickles = envelopes.filter(e => e.pickle).map(e => e.pickle!);

        if (!gherkinDocument || !gherkinDocument.feature) {
            throw new Error(`Failed to parse Gherkin document: ${uri}`);
        }

        const feature = gherkinDocument.feature;
        
        return {
            uri,
            name: feature.name,
            tags: feature.tags.map(t => t.name),
            scenarios: pickles.map(pickle => this.mapPickleToScenario(pickle, feature))
        };
    }

    private mapPickleToScenario(pickle: Pickle, feature: Feature): GherkinScenario {
        // Find the original scenario AST for line numbers
        const scenarioAst = feature.children
            .find(child => child.scenario?.id === pickle.astNodeIds[0])?.scenario;

        let line = scenarioAst?.location.line || 0;
        let outlineLine: number | undefined;

        if (scenarioAst && pickle.astNodeIds.length > 1) {
            const rowId = pickle.astNodeIds[1];
            for (const example of scenarioAst.examples || []) {
                const row = example.tableBody?.find(r => r.id === rowId);
                if (row) {
                    outlineLine = scenarioAst.location.line;
                    line = row.location.line;
                    break;
                }
            }
        }

        return {
            id: pickle.id,
            name: pickle.name,
            line,
            outlineLine,
            tags: pickle.tags.map(t => t.name),
            steps: pickle.steps.map(step => ({
                keyword: this.findStepKeyword(step.astNodeIds[0], scenarioAst),
                text: step.text,
                line: this.findStepLine(step.astNodeIds[0], scenarioAst),
                column: 0 // Location extraction can be refined
            }))
        };
    }

    private findStepKeyword(astNodeId: string, scenario?: Scenario): string {
        return scenario?.steps.find(s => s.id === astNodeId)?.keyword || '';
    }

    private findStepLine(astNodeId: string, scenario?: Scenario): number {
        return scenario?.steps.find(s => s.id === astNodeId)?.location.line || 0;
    }

    private async getEnvelopes(uri: string, content: string): Promise<Envelope[]> {
        const options: IGherkinOptions = {
            includeSource: false,
            includeGherkinDocument: true,
            includePickles: true,
            newId: () => Math.random().toString() // Basic ID generator for AST
        };

        return generateMessages(
            content,
            uri,
            'text/x.cucumber.gherkin+plain' as any,
            options
        ) as Envelope[];
    }
}
