import { injectable } from 'inversify';

/** A single test run outcome recorded for history tracking. */
export interface RunRecord {
    /** ISO timestamp of when the run completed. */
    timestamp: string;
    /** Pass, fail, or errored. */
    status: 'passed' | 'failed' | 'errored';
    /** Error message if status is failed/errored. */
    errorMessage?: string;
    /** Duration in milliseconds, if available. */
    durationMs?: number;
}

const MAX_HISTORY = 20;

@injectable()
export class TestStateStore {
    // Latest failure message per scenario (used by auto-heal code lens)
    private failedScenarios = new Map<string, string>();

    // Full run history per scenario, capped at MAX_HISTORY entries
    private runHistory = new Map<string, RunRecord[]>();

    // ── Existing API (preserved, unchanged) ─────────────────────────────────

    public recordFailure(scenarioIdOrName: string, errorMessage: string) {
        this.failedScenarios.set(scenarioIdOrName, errorMessage);
        this.appendHistory(scenarioIdOrName, { status: 'failed', errorMessage });
    }

    public recordSuccess(scenarioIdOrName: string) {
        this.failedScenarios.delete(scenarioIdOrName);
        this.appendHistory(scenarioIdOrName, { status: 'passed' });
    }

    public getFailure(scenarioIdOrName: string): string | undefined {
        return this.failedScenarios.get(scenarioIdOrName);
    }

    public clear() {
        this.failedScenarios.clear();
        // Note: history is intentionally NOT cleared — it persists across runs.
    }

    // ── New History API (FEAT-002) ───────────────────────────────────────────

    /**
     * Appends a run record to the history for a scenario.
     * Automatically caps the list at MAX_HISTORY (20) entries, dropping the oldest.
     */
    public appendHistory(
        scenarioIdOrName: string,
        record: Omit<RunRecord, 'timestamp'>
    ): void {
        const fullRecord: RunRecord = {
            ...record,
            timestamp: new Date().toISOString()
        };
        const existing = this.runHistory.get(scenarioIdOrName) ?? [];
        const updated = [...existing, fullRecord].slice(-MAX_HISTORY);
        this.runHistory.set(scenarioIdOrName, updated);
    }

    /**
     * Returns the run history for a specific scenario, newest-last.
     * Returns an empty array if no history exists.
     */
    public getHistory(scenarioIdOrName: string): RunRecord[] {
        return this.runHistory.get(scenarioIdOrName) ?? [];
    }

    /**
     * Returns a summary of all scenarios that have history, with their
     * last outcome and total run count. Used to render the history overview.
     */
    public getAllHistorySummary(): Array<{
        id: string;
        lastStatus: RunRecord['status'];
        lastTimestamp: string;
        totalRuns: number;
        passRate: number;
    }> {
        const summary = [];
        for (const [id, records] of this.runHistory.entries()) {
            if (records.length === 0) { continue; }
            const last = records[records.length - 1];
            const passCount = records.filter(r => r.status === 'passed').length;
            summary.push({
                id,
                lastStatus: last.status,
                lastTimestamp: last.timestamp,
                totalRuns: records.length,
                passRate: Math.round((passCount / records.length) * 100)
            });
        }
        return summary.sort((a, b) => b.lastTimestamp.localeCompare(a.lastTimestamp));
    }
}
