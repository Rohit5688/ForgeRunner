import * as vscode from 'vscode';
import * as path from 'path';
import { injectable, inject } from 'inversify';
import { TYPES } from '../core/types.js';
import { AutoDiscoveryService, DiscoveredWorkspace } from '../core/autoDiscovery.js';

/**
 * FEAT-005: Multi-Workspace Explorer
 *
 * A VS Code TreeDataProvider that lists all discovered Playwright-BDD workspaces
 * in the Forge AI Activity Bar sidebar. Each workspace shows its detected config
 * (projectRoot, featureFolder, stepsFolder, featureCount) as child items.
 *
 * Safety rules followed:
 *  - `getTreeItem()` and `getChildren()` never throw — all errors are caught and
 *    returned as informational tree items.
 *  - No file I/O on the main thread. Data comes from AutoDiscoveryService's
 *    in-memory registry which was populated asynchronously during `run()`.
 *  - `refresh()` is safe to call at any time; it only fires the event emitter.
 */
@injectable()
export class WorkspaceExplorerProvider implements vscode.TreeDataProvider<WorkspaceTreeItem> {

    private _onDidChangeTreeData = new vscode.EventEmitter<WorkspaceTreeItem | undefined | void>();
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    constructor(
        @inject(TYPES.AutoDiscoveryService) private readonly discovery: AutoDiscoveryService
    ) {}

    /** Forces a visual refresh of the entire tree. Call after AutoDiscovery.run() completes. */
    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // ── TreeDataProvider implementation ─────────────────────────────────────

    public getTreeItem(element: WorkspaceTreeItem): vscode.TreeItem {
        return element;
    }

    public getChildren(element?: WorkspaceTreeItem): WorkspaceTreeItem[] {
        try {
            if (!element) {
                // Root level: show all discovered workspaces
                const workspaces = this.discovery.getDiscoveredWorkspaces();
                if (workspaces.length === 0) {
                    return [new WorkspaceTreeItem(
                        'No workspaces detected yet',
                        'Run a test or open a .feature file to trigger discovery.',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    )];
                }
                return workspaces.map(ws => WorkspaceTreeItem.fromWorkspace(ws));
            }

            // Child level: workspace detail rows
            if (element.workspace) {
                return this.buildDetailItems(element.workspace);
            }
        } catch (e: any) {
            return [new WorkspaceTreeItem(`Error: ${e.message}`, '', vscode.TreeItemCollapsibleState.None, 'error')];
        }
        return [];
    }

    private buildDetailItems(ws: DiscoveredWorkspace): WorkspaceTreeItem[] {
        const items: WorkspaceTreeItem[] = [];

        items.push(new WorkspaceTreeItem(
            `📁 Root: ${ws.projectRoot || '(workspace root)'}`,
            ws.rootPath,
            vscode.TreeItemCollapsibleState.None,
            'folder'
        ));

        items.push(new WorkspaceTreeItem(
            `🥒 Features: ${ws.featureFolder || '(auto-scan)'} · ${ws.featureCount} file${ws.featureCount !== 1 ? 's' : ''}`,
            ws.featureFolder ? path.join(ws.rootPath, ws.featureFolder) : ws.rootPath,
            vscode.TreeItemCollapsibleState.None,
            'feature'
        ));

        items.push(new WorkspaceTreeItem(
            `🔧 Steps: ${ws.stepsFolder || '(auto-scan)'}`,
            ws.stepsFolder ? path.join(ws.rootPath, ws.stepsFolder) : ws.rootPath,
            vscode.TreeItemCollapsibleState.None,
            'steps'
        ));

        // Quick-switch action
        const switchItem = new WorkspaceTreeItem(
            `$(arrow-right) Set as Active Project`,
            'Click to update forge-runner settings to point to this workspace',
            vscode.TreeItemCollapsibleState.None,
            'action'
        );
        switchItem.command = {
            command: 'forge-runner.workspace.switchTo',
            title: 'Switch to Workspace',
            arguments: [ws]
        };
        items.push(switchItem);

        return items;
    }
}

// ── Tree Item ──────────────────────────────────────────────────────────────

export class WorkspaceTreeItem extends vscode.TreeItem {
    constructor(
        label: string,
        tooltip: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        readonly kind: 'workspace' | 'folder' | 'feature' | 'steps' | 'action' | 'info' | 'error',
        public readonly workspace?: DiscoveredWorkspace
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.iconPath = WorkspaceTreeItem.iconFor(kind);
    }

    static fromWorkspace(ws: DiscoveredWorkspace): WorkspaceTreeItem {
        const item = new WorkspaceTreeItem(
            ws.name,
            ws.rootPath,
            vscode.TreeItemCollapsibleState.Collapsed,
            'workspace',
            ws
        );
        item.description = ws.projectRoot || '';
        item.contextValue = 'forgeWorkspace';
        return item;
    }

    private static iconFor(kind: WorkspaceTreeItem['kind']): vscode.ThemeIcon {
        switch (kind) {
            case 'workspace': return new vscode.ThemeIcon('folder-library');
            case 'folder':    return new vscode.ThemeIcon('root-folder');
            case 'feature':   return new vscode.ThemeIcon('symbol-file');
            case 'steps':     return new vscode.ThemeIcon('symbol-method');
            case 'action':    return new vscode.ThemeIcon('arrow-right');
            case 'error':     return new vscode.ThemeIcon('error');
            case 'info':
            default:          return new vscode.ThemeIcon('info');
        }
    }
}
