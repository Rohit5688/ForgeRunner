import * as vscode from 'vscode';
import { ILLMProvider, LLMMessage } from '../provider.js';
import { injectable } from 'inversify';

@injectable()
export class AnthropicProvider implements ILLMProvider {
    public readonly id = 'anthropic';
    public readonly name = 'Anthropic (Claude)';

    public async chat(
        messages: LLMMessage[],
        onProgress: (chunk: string) => void,
        token: vscode.CancellationToken
    ): Promise<string> {
        const config = vscode.workspace.getConfiguration('forge-runner.ai.anthropic');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            throw new Error('Anthropic API Key not found in settings (forge-runner.ai.anthropic.apiKey).');
        }

        // Placeholder for Anthropic SDK integration
        // In a real implementation:
        // const client = new Anthropic({ apiKey });
        // const stream = await client.messages.create({ ... });
        
        onProgress('Anthropic Provider matched! (SDK Integration Placeholder)');
        return 'Anthropic response placeholder';
    }
}
