import * as vscode from 'vscode';
import { injectable } from 'inversify';

@injectable()
export class OnboardingService {
    private panel?: vscode.WebviewPanel;

    public async show(context: vscode.ExtensionContext) {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const conflicts = this.checkConflicts();

        this.panel = vscode.window.createWebviewPanel(
            'forgeRunnerOnboarding',
            'Forge Runner: Setup Wizard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.webview.html = this.getHtml(conflicts);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveConfig':
                    await this.handleSaveConfig(message.data);
                    vscode.window.showInformationMessage('Configuration saved! Forge Runner is ready.');
                    this.panel?.dispose();
                    break;
            }
        });

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });
    }

    private async handleSaveConfig(data: any) {
        const config = vscode.workspace.getConfiguration('forge-runner');
        await config.update('ai.provider', data.aiProvider, vscode.ConfigurationTarget.Global);
        await config.update('ai.mcpServerPath', data.mcpPath, vscode.ConfigurationTarget.Global);
        if (data.anthropicKey) {
            await config.update('ai.anthropic.apiKey', data.anthropicKey, vscode.ConfigurationTarget.Global);
        }
    }

    private checkConflicts(): string[] {
        const conflictIds = ['alexkrechik.cucumberautocomplete', 'cucumber.cucumber-viewer'];
        const found = [];
        for (const id of conflictIds) {
            if (vscode.extensions.getExtension(id)) {
                found.push(id);
            }
        }
        return found;
    }

    private getHtml(conflicts: string[]) {
        const conflictWarning = conflicts.length > 0 
            ? `<div style="color: #ff9800; margin-bottom: 20px;">⚠️ <b>Warning</b>: Detected other Gherkin/Cucumber extensions (${conflicts.join(', ')}). You may see duplicate autocompletion results. Suggest disabling them for optimal Forge Runner experience.</div>`
            : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 40px; line-height: 1.6; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
                .step { display: none; }
                .step.active { display: block; }
                .card { background: var(--vscode-sideBar-background); padding: 20px; border-radius: 8px; border: 1px solid var(--vscode-panel-border); }
                h1 { color: var(--vscode-button-background); margin-top: 0; }
                label { display: block; margin-top: 15px; font-weight: bold; }
                input, select { width: 100%; padding: 8px; margin-top: 5px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); color: var(--vscode-input-foreground); }
                .buttons { margin-top: 30px; display: flex; gap: 10px; }
                button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; cursor: pointer; border-radius: 2px; }
                button:hover { background: var(--vscode-button-hoverBackground); }
                button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
            </style>
        </head>
        <body>
            <div id="step-1" class="step active">
                <div class="card">
                    <h1>Welcome to Forge Runner</h1>
                    ${conflictWarning}
                    <p>Let's get your BDD workspace ready for AI-powered automation.</p>
                    <button onclick="next(2)">Start Setup</button>
                </div>
            </div>

            <div id="step-2" class="step">
                <div class="card">
                    <h1>AI Provider</h1>
                    <label>Select your LLM Backend:</label>
                    <select id="aiProvider">
                        <option value="vscode-lm">GitHub Copilot (Built-in)</option>
                        <option value="anthropic">Anthropic Claude (API Key)</option>
                    </select>
                    <div id="anthropic-key-field" style="display:none">
                        <label>Anthropic API Key:</label>
                        <input type="password" id="anthropicKey" />
                    </div>
                    <div class="buttons">
                        <button class="secondary" onclick="next(1)">Back</button>
                        <button onclick="next(3)">Next</button>
                    </div>
                </div>
            </div>

            <div id="step-3" class="step">
                <div class="card">
                    <h1>MCP Configuration</h1>
                    <label>Path to specialized BDD MCP tool (index.js):</label>
                    <input type="text" id="mcpPath" placeholder="(Auto-detected) or enter manual path..." />
                    <div class="buttons">
                        <button class="secondary" onclick="next(2)">Back</button>
                        <button onclick="finish()">Finish</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                
                document.getElementById('aiProvider').onchange = (e) => {
                    document.getElementById('anthropic-key-field').style.display = e.target.value === 'anthropic' ? 'block' : 'none';
                };

                function next(step) {
                    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
                    document.getElementById('step-' + step).classList.add('active');
                }

                function finish() {
                    const data = {
                        aiProvider: document.getElementById('aiProvider').value,
                        anthropicKey: document.getElementById('anthropicKey').value,
                        mcpPath: document.getElementById('mcpPath').value
                    };
                    vscode.postMessage({ command: 'saveConfig', data });
                }
            </script>
        </body>
        </html>
        `;
    }
}
