import * as vscode from 'vscode';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { TestStateStore, RunRecord } from '../core/testStateStore.js';

/**
 * FEAT-002: Test History View
 *
 * Renders a VS Code Webview panel showing per-scenario test run history with
 * pass/fail sparklines and a summary table. Triggered by the
 * `forge-runner.showTestHistory` command.
 */
@injectable()
export class TestHistoryView {
    private panel: vscode.WebviewPanel | undefined;

    constructor(
        @inject(TYPES.TestStateStore) private readonly store: TestStateStore
    ) {}

    /**
     * Opens (or re-focuses) the Test History panel and renders current history.
     */
    public show(context: vscode.ExtensionContext): void {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            this.refresh();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'forgeTestHistory',
            '⏱ Forge Test History',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [context.extensionUri]
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        });

        this.refresh();
    }

    /**
     * Re-renders the webview with the latest data from TestStateStore.
     * Can be called after each test run to keep history live-updated.
     */
    public refresh(): void {
        if (!this.panel) { return; }
        const summary = this.store.getAllHistorySummary();
        this.panel.webview.html = this.buildHtml(summary);
    }

    // ── HTML Generation ──────────────────────────────────────────────────────

    private buildHtml(summary: ReturnType<TestStateStore['getAllHistorySummary']>): string {
        const rows = summary.length === 0
            ? `<tr><td colspan="5" class="empty">No test history yet. Run tests to populate.</td></tr>`
            : summary.map(s => {
                const sparkline = this.buildSparkline(this.store.getHistory(s.id));
                const statusIcon = s.lastStatus === 'passed' ? '✅' : s.lastStatus === 'failed' ? '❌' : '⚠️';
                const timeAgo = this.formatTimeAgo(s.lastTimestamp);
                const passRateClass = s.passRate >= 80 ? 'rate-good' : s.passRate >= 50 ? 'rate-warn' : 'rate-bad';
                return `
                    <tr>
                        <td class="scenario" title="${this.esc(s.id)}">${this.esc(this.shortName(s.id))}</td>
                        <td>${statusIcon}</td>
                        <td>${sparkline}</td>
                        <td class="${passRateClass}">${s.passRate}%</td>
                        <td class="muted">${timeAgo} · ${s.totalRuns} runs</td>
                    </tr>`;
            }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forge Test History</title>
    <style>
        :root {
            --pass: #4caf50;
            --fail: #f44336;
            --warn: #ff9800;
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --border: var(--vscode-panel-border, #444);
            --row-hover: var(--vscode-list-hoverBackground);
            --muted: var(--vscode-descriptionForeground);
            --header-bg: var(--vscode-sideBar-background);
        }
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--fg);
            background: var(--bg);
            margin: 0;
            padding: 0;
        }
        header {
            background: var(--header-bg);
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 12px;
        }
        header h1 { font-size: 14px; margin: 0; font-weight: 600; }
        header .subtitle { font-size: 11px; color: var(--muted); }
        .container { padding: 12px 16px; }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        th {
            text-align: left;
            padding: 6px 8px;
            border-bottom: 1px solid var(--border);
            color: var(--muted);
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        tr:hover td { background: var(--row-hover); }
        td {
            padding: 7px 8px;
            border-bottom: 1px solid var(--border, #2a2a2a);
            vertical-align: middle;
            white-space: nowrap;
        }
        td.scenario {
            max-width: 240px;
            overflow: hidden;
            text-overflow: ellipsis;
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
        }
        td.muted { color: var(--muted); font-size: 11px; }
        td.empty { text-align: center; color: var(--muted); padding: 32px; }
        .rate-good { color: var(--pass); font-weight: 600; }
        .rate-warn { color: var(--warn); font-weight: 600; }
        .rate-bad  { color: var(--fail); font-weight: 600; }
        .spark { display: inline-flex; gap: 2px; align-items: flex-end; height: 16px; }
        .spark-bar {
            width: 4px;
            border-radius: 1px;
        }
        .refresh-btn {
            margin-left: auto;
            padding: 4px 10px;
            font-size: 11px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
        }
        .refresh-btn:hover { background: var(--vscode-button-hoverBackground); }
    </style>
</head>
<body>
    <header>
        <div>
            <h1>⏱ Test Run History</h1>
            <div class="subtitle">${summary.length} scenario${summary.length !== 1 ? 's' : ''} tracked · last 20 runs per scenario</div>
        </div>
        <button class="refresh-btn" onclick="vscode.postMessage({ type: 'refresh' })">⟳ Refresh</button>
    </header>
    <div class="container">
        <table>
            <thead>
                <tr>
                    <th>Scenario</th>
                    <th>Last</th>
                    <th>Trend (newest →)</th>
                    <th>Pass Rate</th>
                    <th>Info</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }

    /**
     * Builds a mini sparkline HTML showing the last N run statuses as colored bars.
     */
    private buildSparkline(records: RunRecord[]): string {
        if (records.length === 0) { return '<span class="muted">—</span>'; }
        const recent = records.slice(-15); // show last 15 in the spark
        const bars = recent.map(r => {
            const color = r.status === 'passed' ? '#4caf50' : r.status === 'failed' ? '#f44336' : '#ff9800';
            const height = r.status === 'passed' ? 12 : r.status === 'errored' ? 8 : 10;
            const title = `${r.status} · ${new Date(r.timestamp).toLocaleString()}${r.errorMessage ? ` · ${r.errorMessage.slice(0, 60)}` : ''}`;
            return `<div class="spark-bar" style="background:${color};height:${height}px" title="${this.esc(title)}"></div>`;
        }).join('');
        return `<span class="spark">${bars}</span>`;
    }

    private shortName(id: string): string {
        // Trim leading path segments for readability
        const parts = id.split(/[/\\>]/);
        return parts[parts.length - 1] ?? id;
    }

    private esc(s: string): string {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private formatTimeAgo(isoDate: string): string {
        const diff = Date.now() - new Date(isoDate).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 1) { return 'just now'; }
        if (minutes < 60) { return `${minutes}m ago`; }
        const hours = Math.floor(minutes / 60);
        if (hours < 24) { return `${hours}h ago`; }
        return `${Math.floor(hours / 24)}d ago`;
    }
}
