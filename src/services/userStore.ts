import * as vscode from 'vscode';
import { injectable } from 'inversify';

export interface ProjectMetadata {
    mcpConnected: boolean;
    lastAiAnalysis?: string;
    favoriteTools: string[];
    customSettings: Record<string, any>;
}

@injectable()
export class UserStoreService {
    private readonly STORAGE_KEY = 'forge-runner.project-metadata';

    constructor() {}

    /**
     * Retrieves metadata for a specific workspace folder.
     */
    public getMetadata(context: vscode.ExtensionContext): ProjectMetadata {
        const data = context.workspaceState.get<ProjectMetadata>(this.STORAGE_KEY);
        return data || {
            mcpConnected: false,
            favoriteTools: [],
            customSettings: {}
        };
    }

    /**
     * Updates project metadata.
     */
    public async updateMetadata(context: vscode.ExtensionContext, update: Partial<ProjectMetadata>): Promise<void> {
        const current = this.getMetadata(context);
        const newData = { ...current, ...update };
        await context.workspaceState.update(this.STORAGE_KEY, newData);
    }
}
