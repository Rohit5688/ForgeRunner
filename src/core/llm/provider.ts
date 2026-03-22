import * as vscode from 'vscode';

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ILLMProvider {
    readonly id: string;
    readonly name: string;
    
    chat(
        messages: LLMMessage[],
        onProgress: (chunk: string) => void,
        token: vscode.CancellationToken
    ): Promise<string>;
}
