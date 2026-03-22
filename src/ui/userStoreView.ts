import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { UserStoreService } from '../services/userStore.js';

@injectable()
export class UserStoreProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'forgeUserStore';
    private _view?: vscode.WebviewView;

    constructor(
        @inject(TYPES.UserStore) private userStore: UserStoreService
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        
        this.updateHtml();
    }

    private updateHtml() {
        if (!this._view) {
            return;
        }

        this._view.webview.html = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { font-family: sans-serif; padding: 15px; color: var(--vscode-foreground); }
                        .card { background: var(--vscode-sideBar-background); padding: 10px; border-radius: 4px; border: 1px solid var(--vscode-panel-border); margin-bottom: 10px; }
                        .label { font-size: 0.8em; opacity: 0.7; }
                        .value { font-weight: bold; margin-top: 4px; }
                        .tag { display: inline-block; background: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 2px 6px; border-radius: 2px; font-size: 0.8em; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <h3>Project Dashboard</h3>
                    <div class="card">
                        <div class="label">Engine Status</div>
                        <div class="value">Ready</div>
                        <div class="tag">v2.0.0-alpha</div>
                    </div>
                    <div class="card">
                        <div class="label">MCP Bridge</div>
                        <div class="value">Active</div>
                    </div>
                    <div class="card">
                        <div class="label">AI Analytics</div>
                        <div class="value">No recent analysis</div>
                    </div>
                </body>
            </html>
        `;
    }
}
