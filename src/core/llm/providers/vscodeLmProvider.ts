import * as vscode from 'vscode';
import { ILLMProvider, LLMMessage } from '../provider.js';
import { injectable } from 'inversify';

@injectable()
export class VscodeLmProvider implements ILLMProvider {
    public readonly id = 'vscode-lm';
    public readonly name = 'VS Code Language Model';

    public async chat(
        messages: LLMMessage[],
        onProgress: (chunk: string) => void,
        token: vscode.CancellationToken
    ): Promise<string> {
        let allModels: vscode.LanguageModelChat[] = [];
        try {
            allModels = await vscode.lm.selectChatModels();
        } catch {
            // API might fail if not fully initialized
        }

        if (!allModels || allModels.length === 0) {
            throw new Error(
                'No Built-In Language Models are available in this IDE.\n' +
                'To use Forge AI, please choose one of these options:\n' +
                '1. Install and Sign In to the GitHub Copilot extension (provides free access to GPT, Claude, and Gemini) keep forge-runner.ai.provider default selected vscode-lm\n' +
                '2. OR, set "forge-runner.ai.provider" to "anthropic", and provide your own API key'
            );
        }

        // Read any custom models the user has populated in Settings so they take precedence
        const config = vscode.workspace.getConfiguration('forge-runner.ai');
        const customModels = config.get<string>('preferredModelFamilies') || '';
        const userFamilies = customModels.split(',').map(m => m.trim().toLowerCase()).filter(m => m.length > 0);

        // We include future models prioritizing smartest down to fastest.
        const prioritizedFamilies = [
            ...userFamilies,
            'gpt-5.4',
            'gpt-5.3-codex',
            'gpt-5.2',
            'gpt-5.1',
            'gpt-5',
            'claude-sonnet-4.6',
            'claude-sonnet-4.5',
            'claude-sonnet-4',
            'claude-opus-4.6',
            'claude-opus-4.5',
            'claude-haiku-4.5',
            'gemini-3.1-pro',
            'gemini-3-pro',
            'gemini-3-flash',
            'gemini-2.5-pro',
            'grok-code-fast-1',
            'o3-mini', 
            'o1',
            'claude-4-sonnet',
            'claude-3.5-sonnet', 
            'gemini-1.5-pro',
            'gpt-4o', 
            'grok',
            'claude', 
            'gemini', 
            'gpt-4.1',
            'gpt-4',
            'gpt-5-mini',
            'gpt-3.5-turbo'
        ];

        let model = allModels[0]; // fallback to whatever the system defaults to if we can't prioritize

        for (const fam of prioritizedFamilies) {
            const match = allModels.find(m => 
                m.family.toLowerCase().includes(fam) || 
                m.name.toLowerCase().includes(fam) || 
                m.id.toLowerCase().includes(fam)
            );
            if (match) {
                model = match;
                break;
            }
        }
        onProgress(`*Using model: ${model.name || model.id}*\n\n`);

        const vscodeMessages = messages.map(m => {
            if (m.role === 'user') {
                return vscode.LanguageModelChatMessage.User(m.content);
            }
            if (m.role === 'assistant') {
                return vscode.LanguageModelChatMessage.Assistant(m.content);
            }
            return vscode.LanguageModelChatMessage.User(`[System Prompt]: ${m.content}`);
        });

        const response = await model.sendRequest(vscodeMessages, {}, token);
        
        let fullText = '';
        for await (const chunk of response.text) {
            onProgress(chunk);
            fullText += chunk;
        }

        return fullText;
    }
}
