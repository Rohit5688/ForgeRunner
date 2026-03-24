import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@injectable()
export class McpBridgeService {
    private client: Client | undefined;
    private transport: StdioClientTransport | undefined;
    private statusBarItem: vscode.StatusBarItem;

    constructor(
        @inject(TYPES.Logger) private logger: vscode.OutputChannel
    ) {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'forge-runner.reconnectMcp';
        this.updateStatusBar(false, 'Initializing...');
        this.statusBarItem.show();
    }

    private updateStatusBar(connected: boolean, message?: string) {
        if (connected) {
            this.statusBarItem.text = '$(plug) MCP: Connected';
            this.statusBarItem.tooltip = 'Forge MCP Server is online. Click to reconnect.';
            this.statusBarItem.backgroundColor = undefined;
        } else {
            this.statusBarItem.text = `$(error) MCP: Disconnected`;
            this.statusBarItem.tooltip = message || 'Forge MCP Server is offline. Click to reconnect.';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
    }

    /**
     * Attempts to auto-discover the MCP server transport configuration.
     * Checks Settings -> Standard Paths -> Cline/Claude Configs -> NPX Fallback.
     */
    private async resolveMcpTransport(): Promise<{ command: string, args: string[] }> {
        // 1. Check user workspace settings
        const config = vscode.workspace.getConfiguration('forge-runner.ai');
        const settingsPath = config.get<string>('mcpServerPath');
        if (settingsPath && fs.existsSync(settingsPath)) {
            this.logger.appendLine(`[MCP Discovery] Using manually configured path: ${settingsPath}`);
            return { command: 'node', args: [settingsPath] };
        }

        // 2. Check Standard installation paths
        const homeDir = os.homedir();
        const standardPath = path.join(homeDir, 'mcp', 'TestForge', 'dist', 'index.js');
        if (fs.existsSync(standardPath)) {
            this.logger.appendLine(`[MCP Discovery] Found MCP server in standard directory: ${standardPath}`);
            return { command: 'node', args: [standardPath] };
        }

        // 3. Attempt to reverse-engineer Cline/Roo-Cline/Claude Desktop config
        const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(homeDir, 'Library', 'Application Support') : path.join(homeDir, '.config'));
        const mcpConfigPaths = [
            path.join(appData, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
            path.join(appData, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json'),
            path.join(appData, 'Claude', 'claude_desktop_config.json')
        ];

        for (const configPath of mcpConfigPaths) {
            if (fs.existsSync(configPath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    if (data.mcpServers) {
                        for (const serverName of Object.keys(data.mcpServers)) {
                            const server = data.mcpServers[serverName];
                            if (server.command === 'node' && server.args) {
                                for (const arg of server.args) {
                                    if (arg.includes('TestForge') && fs.existsSync(arg)) {
                                        this.logger.appendLine(`[MCP Discovery] Discovered path via ${serverName} config: ${arg}`);
                                        return { command: 'node', args: [arg] };
                                    }
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    this.logger.appendLine(`[MCP Discovery] Failed to parse config at ${configPath}: ${e.message}`);
                }
            }
        }

        // 4. Guaranteed Fallback: NPX Registry Download
        this.logger.appendLine(`[MCP Discovery] Local path not found. Falling back to guaranteed NPX resolution.`);
        return { command: 'npx', args: ['-y', 'testforge'] };
    }

    /**
     * Connects to the TestForge server via stdio.
     */
    public async connect(): Promise<boolean> {
        this.updateStatusBar(false, 'Connecting...');
        const transportConfig = await this.resolveMcpTransport();

        try {
            this.transport = new StdioClientTransport({
                command: transportConfig.command,
                args: transportConfig.args,
            });

            this.client = new Client({
                name: 'playwright-bdd-enterprise-host',
                version: '2.0.0',
            }, {
                capabilities: {}
            });

            await this.client.connect(this.transport);
            this.logger.appendLine(`[MCP Client] Connected successfully via ${transportConfig.command}`);
            this.updateStatusBar(true);
            return true;
        } catch (error: any) {
            this.logger.appendLine(`[MCP Error] Failed to connect: ${error.message}`);
            this.updateStatusBar(false, error.message);
            return false;
        }
    }

    /**
     * Calls a specific tool on the MCP server.
     */
    public async callTool(name: string, args: any, timeoutMs: number = 60000): Promise<any> {
        if (!this.client) {
            throw new Error('MCP Client not connected.');
        }

        const callPromise = this.client.callTool({
            name,
            arguments: args
        });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Tool execution for '${name}' timed out after ${timeoutMs}ms.`)), timeoutMs)
        );

        return await Promise.race([callPromise, timeoutPromise]);
    }

    public async listTools() {
        if (!this.client) {
            return [];
        }
        const result = await this.client.listTools();
        return result.tools;
    }

    public async dispose() {
        if (this.transport) {
            await this.transport.close();
        }
        this.statusBarItem.dispose();
    }
}
