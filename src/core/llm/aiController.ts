import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types.js';
import { McpBridgeService } from '../../services/mcpBridge.js';
import { ILLMProvider, LLMMessage } from './provider.js';

@injectable()
export class AiController {
    constructor(
        @inject(TYPES.McpBridge) private mcpBridge: McpBridgeService,
        @inject(TYPES.LLMProvider) private vscodeProvider: ILLMProvider,
        @inject(TYPES.AnthropicProvider) private anthropicProvider: ILLMProvider
    ) {}

    public async chat(message: string, onProgress: (chunk: string) => void): Promise<string> {
        const config = vscode.workspace.getConfiguration('forge-runner.ai');
        const providerId = config.get<string>('provider') || 'vscode-lm';

        // ── MCP-Direct Mode: route commands directly through MCP tools ─────
        // If the message looks like an MCP tool request, bypass LLM entirely
        const mcpDirect = this.tryMcpDirect(message);
        if (mcpDirect) {
            onProgress(`\n*[MCP Direct]: Executing tool \`${mcpDirect.tool}\`...*\n\n`);
            try {
                const result = await this.mcpBridge.callTool(mcpDirect.tool, mcpDirect.args);
                const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                onProgress(output);
                return output;
            } catch (err: any) {
                const errMsg = `MCP Tool Error: ${err.message}`;
                onProgress(errMsg);
                return errMsg;
            }
        }

        // ── LLM-Powered Mode: full agentic loop with tool calling ──────────
        const provider = providerId === 'anthropic' ? this.anthropicProvider : this.vscodeProvider;

        // Extract precise tool schemas from the MCP server
        let toolSchemas = '(no tools available)';
        try {
            const tools = await this.mcpBridge.listTools();
            toolSchemas = JSON.stringify(tools, null, 2);
        } catch {
            // MCP not connected, proceed without tools
        }

        const systemPrompt = `You are an expert BDD automation engineer. 
You have access to the following tools via an MCP server:
${toolSchemas}

If you need to use a tool, you MUST output a JSON block exactly like this:
\`\`\`json
{
  "tool_call": {
    "name": "<tool_name>",
    "arguments": { <args> }
  }
}
\`\`\`
Stop writing and wait for the tool result. After receiving the tool result, explain the outcome or call another tool.
If you DO NOT need a tool, just answer normally.`;

        const messages: LLMMessage[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ];

        let iterations = 0;
        const maxIterations = 5;
        let finalOutput = '';

        while (iterations < maxIterations) {
            iterations++;
            onProgress(`\n*[Agent]: Thinking (Step ${iterations}/${maxIterations})...*\n`);
            
            let response: string;
            try {
                response = await provider.chat(
                    messages, 
                    (chunk) => {
                        if (!chunk.includes('```json') && !chunk.includes('tool_call')) {
                            onProgress(chunk);
                        }
                    }, 
                    new vscode.CancellationTokenSource().token
                );
            } catch (err: any) {
                // If LLM fails, return the localized error directly without injecting redundant MCP command instructions
                const fallbackMsg = `❌ LLM Error: ${err.message}\n`;
                onProgress(fallbackMsg);
                return fallbackMsg;
            }

            messages.push({ role: 'assistant', content: response });

            // Check if the LLM requested a tool execution
            const toolRegex = /```json\s*(\{[\s\S]*?"tool_call"[\s\S]*?\})\s*```/;
            const match = response.match(toolRegex);

            if (match) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed.tool_call && parsed.tool_call.name) {
                        const { name, arguments: args } = parsed.tool_call;
                        onProgress(`\n*[Agent]: Executing tool \`${name}\`...*\n`);
                        
                        const toolResult = await this.mcpBridge.callTool(name, args || {});
                        const resultString = JSON.stringify(toolResult, null, 2);
                        
                        onProgress(`\n*[Agent]: Tool execution complete.*\n`);
                        
                        messages.push({ 
                            role: 'user', 
                            content: `[Tool Result for ${name}]:\n${resultString}\n\nContinue your task.` 
                        });
                        continue;
                    }
                } catch (e: any) {
                    messages.push({ role: 'user', content: `[Tool Error]: Failed to parse or execute tool. Error: ${e.message}` });
                    continue;
                }
            }

            finalOutput = response;
            break;
        }

        if (iterations >= maxIterations) {
            onProgress(`\n*[Agent]: Halted. Reached maximum iterations.*\n`);
        }

        return finalOutput;
    }

    /**
     * Detects if a user message is a direct MCP tool command.
     * Returns tool name and args, or null if it's a general chat.
     */
    private tryMcpDirect(message: string): { tool: string; args: Record<string, any> } | null {
        const lower = message.toLowerCase().trim();
        const projectRoot = this.getProjectRoot();

        if (lower.startsWith('analyze code') || lower.startsWith('analyze project')) {
            return { tool: 'analyze_codebase', args: { projectRoot } };
        }
        if (lower.startsWith('inspect ') || lower.startsWith('inspect page') || lower.startsWith('inspect dom')) {
            const urlMatch = message.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                return { tool: 'inspect_page_dom', args: { url: urlMatch[0] } };
            }
        }
        if (lower.startsWith('run test') || lower.startsWith('execute test')) {
            return { tool: 'run_playwright_test', args: { projectRoot } };
        }
        if (lower.startsWith('generate test') || lower.startsWith('create test')) {
            const desc = message.replace(/^.*?(generate|create)\s+test\s*(for|:)?\s*/i, '').trim();
            return { tool: 'generate_gherkin_pom_test_suite', args: { testDescription: desc || message, projectRoot } };
        }
        if (lower === 'list tools' || lower === 'available tools' || lower === 'help') {
            return { tool: 'list_tools_internal', args: {} };
        }
        return null;
    }

    private getProjectRoot(): string {
        const folders = vscode.workspace.workspaceFolders;
        return folders && folders.length > 0 ? folders[0].uri.fsPath : '.';
    }
}
