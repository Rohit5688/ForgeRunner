import * as vscode from 'vscode';
import { injectable, inject, optional } from 'inversify';
import { TYPES } from '../core/types.js';
import { AiController } from '../core/llm/aiController.js';

@injectable()
export class AiSidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'playwright-bdd-ai-chat';
    private _view?: vscode.WebviewView;

    constructor(
        @inject(TYPES.AiController) private aiController: AiController,
        @optional() @inject(TYPES.Logger) private logger?: vscode.OutputChannel
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this.logger?.appendLine('[AiSidebar] resolveWebviewView called');
        this._view = webviewView;
        webviewView.webview.options = { enableScripts: true };
        webviewView.webview.html = this.getHtmlContent();
        this.logger?.appendLine('[AiSidebar] HTML injected');

        webviewView.webview.onDidReceiveMessage(async (data) => {
            if (data.type === 'sendMessage') {
                await this.handleUserMessage(data.value);
            }
        });
    }

    private async handleUserMessage(message: string) {
        if (!this._view) { return; }
        try {
            this._view.webview.postMessage({ type: 'startAssistant' });
            await this.aiController.chat(message, (chunk) => {
                this._view?.webview.postMessage({ type: 'chunk', value: chunk });
            });
            this._view.webview.postMessage({ type: 'done' });
        } catch (error: any) {
            this._view.webview.postMessage({ type: 'error', value: error.message });
        }
    }

    /**
     * Public API for external components (like CodeLens) to send messages to the AI
     * and render the response natively inside the sidebar HTML.
     */
    public async simulateUserMessage(message: string) {
        if (!this._view) {
            // Wake up the sidebar if it's hidden
            await vscode.commands.executeCommand('forgeAiSidebar.focus');
        }
        
        // Wait briefly for Webview to finish initializing if it was just awoken
        if (this._view && this._view.webview) {
            // Simulate user typing message (this triggers send() in HTML -> which posts back sendMessage to backend)
            this._view.webview.postMessage({ type: 'simulateSubmit', value: message });
        } else {
            this.logger?.appendLine('[AiSidebar] Warning: _view not ready for simulateUserMessage');
        }
    }

    private getHtmlContent(): string {
        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '<meta charset="UTF-8">',
            '<style>',
            'html,body{height:100%;margin:0;padding:0}',
            'body{display:flex;flex-direction:column;height:100%;',
            'font-family:var(--vscode-font-family,sans-serif);font-size:13px;',
            'background:var(--vscode-sideBar-background);color:var(--vscode-sideBar-foreground)}',
            '#log{flex:1 1 auto;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}',
            '.msg{padding:8px 12px;border-radius:6px;word-break:break-word;white-space:pre-wrap;line-height:1.5}',
            '.u{background:var(--vscode-button-background);color:var(--vscode-button-foreground);margin-left:20%}',
            '.a{background:var(--vscode-editor-inactiveSelectionBackground);border:1px solid var(--vscode-panel-border);margin-right:20%}',
            '.e{background:var(--vscode-inputValidation-errorBackground,#5a1d1d);color:red}',
            '#bar{flex-shrink:0;display:flex;gap:6px;padding:8px;border-top:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background)}',
            '#txt{flex:1;background:var(--vscode-input-background);color:var(--vscode-input-foreground);',
            'border:1px solid var(--vscode-input-border);border-radius:4px;padding:6px 8px;',
            'font-family:inherit;font-size:inherit;resize:none;outline:none}',
            '#txt:focus{border-color:var(--vscode-focusBorder)}',
            '#btn{background:var(--vscode-button-background);color:var(--vscode-button-foreground);',
            'border:none;border-radius:4px;padding:6px 14px;cursor:pointer;font-size:inherit;font-family:inherit}',
            '#btn:hover{background:var(--vscode-button-hoverBackground)}',
            '#btn:disabled{opacity:0.5;cursor:default}',
            '</style>',
            '</head>',
            '<body>',
            '<div id="log">',
            '<div class="msg a">&#x1F916; Hello! I am <b>Forge AI</b>.<br>Ask me to generate step definitions, analyze your codebase, or fix failing tests.<br><br>Type below and press <b>Enter</b> or click <b>Send</b>.</div>',
            '</div>',
            '<div id="bar">',
            '<textarea id="txt" rows="2" placeholder="Ask Forge AI..."></textarea>',
            '<button id="btn">Send</button>',
            '</div>',
            '<script>',
            '(function(){',
            'var vsc=acquireVsCodeApi();',
            'var log=document.getElementById("log");',
            'var txt=document.getElementById("txt");',
            'var btn=document.getElementById("btn");',
            'var cur=null;',
            'function scroll(){log.scrollTop=log.scrollHeight;}',
            'function addMsg(cls,html){var d=document.createElement("div");d.className="msg "+cls;d.innerHTML=html;log.appendChild(d);scroll();return d;}',
            'function send(){',
            '  var t=txt.value.trim();',
            '  if(!t)return;',
            '  txt.value="";',
            '  addMsg("u",t);',
            '  cur=addMsg("a","&#x23F3; Thinking...");',
            '  btn.disabled=true;',
            '  vsc.postMessage({type:"sendMessage",value:t});',
            '}',
            'btn.addEventListener("click",send);',
            'txt.addEventListener("keydown",function(e){',
            '  if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}',
            '});',
            'window.addEventListener("message",function(e){',
            '  var m=e.data;',
            '  if(m.type==="startAssistant"){if(cur)cur.innerHTML="";}',
            '  else if(m.type==="chunk"){if(cur){cur.innerHTML+=m.value.replace(/</g,"&lt;").replace(/>/g,"&gt;");scroll();}}',
            '  else if(m.type==="done"){cur=null;btn.disabled=false;}',
            '  else if(m.type==="simulateSubmit"){txt.value=m.value;send();}',
            '  else if(m.type==="error"){if(cur){cur.className="msg e";cur.innerHTML="&#x274C; "+m.value;}btn.disabled=false;cur=null;}',
            '});',
            '})();',
            '</script>',
            '</body>',
            '</html>'
        ].join('\n');
    }
}
