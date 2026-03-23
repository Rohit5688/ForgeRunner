import { Container } from 'inversify';
import 'reflect-metadata';
import { GherkinParser } from '../parsers/gherkinParser.js';
import { TsParser } from '../parsers/tsParser.js';
import { MatchEngine } from './matcher.js';
import { WorkspaceManager } from './workspaceManager.js';
import { BddTestController } from '../ui/testController.js';
import { BddNavigationProvider } from '../providers/navigationProvider.js';
import { ExecutionService } from '../services/executionService.js';
import { PlaywrightBddAdapter } from '../adapters/playwrightBddAdapter.js';
import { CucumberAdapter } from '../adapters/cucumberAdapter.js';
import { McpBridgeService } from '../services/mcpBridge.js';
import { AiController } from './llm/aiController.js';
import { AiSidebarProvider } from '../ui/aiSidebar.js';
import { BddCompletionProvider } from '../providers/completionProvider.js';
import { OnboardingService } from '../ui/onboarding.js';
import { UserStoreService } from '../services/userStore.js';
import { UserStoreProvider } from '../ui/userStoreView.js';
import { ILLMProvider } from './llm/provider.js';
import { VscodeLmProvider } from './llm/providers/vscodeLmProvider.js';
import { AnthropicProvider } from './llm/providers/anthropicProvider.js';
import { FormattingProvider } from '../providers/formattingProvider.js';
import { StepGenerationCodeLensProvider } from '../providers/stepGenerationCodeLens.js';
import { TestStateStore } from './testStateStore.js';
import { AutoHealCodeLensProvider } from '../providers/autoHealCodeLens.js';
import { ExecutionCodeLensProvider } from '../providers/executionCodeLens.js';
import { AutoDiscoveryService } from './autoDiscovery.js';
import { TYPES } from './types.js';

export { TYPES };
/**
 * Service Registry (DI Container)
 */
const container = new Container();

container.bind<GherkinParser>(TYPES.GherkinParser).to(GherkinParser).inSingletonScope();
container.bind<TsParser>(TYPES.TsParser).to(TsParser).inSingletonScope();
container.bind<MatchEngine>(TYPES.MatchEngine).to(MatchEngine).inSingletonScope();
container.bind<WorkspaceManager>(TYPES.WorkspaceManager).to(WorkspaceManager).inSingletonScope();
container.bind<BddTestController>(TYPES.TestController).to(BddTestController).inSingletonScope();
container.bind<BddNavigationProvider>(TYPES.NavigationProvider).to(BddNavigationProvider).inSingletonScope();
container.bind<ExecutionService>(TYPES.ExecutionService).to(ExecutionService).inSingletonScope();
container.bind<PlaywrightBddAdapter>(TYPES.PlaywrightBddAdapter).to(PlaywrightBddAdapter).inSingletonScope();
container.bind<CucumberAdapter>(TYPES.CucumberAdapter).to(CucumberAdapter).inSingletonScope();
container.bind<McpBridgeService>(TYPES.McpBridge).to(McpBridgeService).inSingletonScope();
container.bind<AiController>(TYPES.AiController).to(AiController).inSingletonScope();
container.bind<AiSidebarProvider>(TYPES.AiSidebar).to(AiSidebarProvider).inSingletonScope();
container.bind<BddCompletionProvider>(TYPES.CompletionProvider).to(BddCompletionProvider).inSingletonScope();
container.bind<ILLMProvider>(TYPES.LLMProvider).to(VscodeLmProvider).inSingletonScope();
container.bind<AnthropicProvider>(TYPES.AnthropicProvider).to(AnthropicProvider).inSingletonScope();
container.bind<OnboardingService>(TYPES.Onboarding).to(OnboardingService).inSingletonScope();
container.bind<UserStoreService>(TYPES.UserStore).to(UserStoreService).inSingletonScope();
container.bind<UserStoreProvider>(TYPES.UserStoreProvider).to(UserStoreProvider).inSingletonScope();
container.bind<FormattingProvider>(TYPES.FormattingProvider).to(FormattingProvider).inSingletonScope();
container.bind<StepGenerationCodeLensProvider>(TYPES.StepGenerationCodeLensProvider).to(StepGenerationCodeLensProvider).inSingletonScope();
container.bind<TestStateStore>(TYPES.TestStateStore).to(TestStateStore).inSingletonScope();
container.bind<AutoHealCodeLensProvider>(TYPES.AutoHealCodeLensProvider).to(AutoHealCodeLensProvider).inSingletonScope();
container.bind<ExecutionCodeLensProvider>(TYPES.ExecutionCodeLensProvider).to(ExecutionCodeLensProvider).inSingletonScope();
container.bind<AutoDiscoveryService>(TYPES.AutoDiscoveryService).to(AutoDiscoveryService).inSingletonScope();

export { container };
