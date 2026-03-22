import { injectable } from 'inversify';

@injectable()
export class TestStateStore {
    // Map of scenario IDs or Names to their latest failure error message
    private failedScenarios = new Map<string, string>();

    public recordFailure(scenarioIdOrName: string, errorMessage: string) {
        this.failedScenarios.set(scenarioIdOrName, errorMessage);
    }

    public recordSuccess(scenarioIdOrName: string) {
        this.failedScenarios.delete(scenarioIdOrName);
    }

    public getFailure(scenarioIdOrName: string): string | undefined {
        return this.failedScenarios.get(scenarioIdOrName);
    }

    public clear() {
        this.failedScenarios.clear();
    }
}
