import { GherkinParser } from './parsers/gherkinParser.js';
import { TsParser } from './parsers/tsParser.js';

async function test() {
    console.log('--- Forge Runner v2: Parser Engine Audit ---');

    // 1. Gherkin Parser Test
    try {
        const gherkin = new GherkinParser();
        const feature = `
Feature: Login
  Scenario: Success
    Given I enter credentials
    Then I am logged in
        `;
        const result = await gherkin.parse('test.feature', feature);
        console.log('✅ GherkinParser: Successfully parsed feature "' + result.name + '"');
        console.log('   - Scenarios found:', result.scenarios.length);
    } catch (e) {
        console.error('❌ GherkinParser failed:', e);
    }

    // 2. TS Parser Test
    try {
        const tsParser = new TsParser();
        const tsContent = `
            import { Given } from '@cucumber/cucumber';
            Given('I enter credentials', async () => {});
        `;
        const patterns = tsParser.parseContent(tsContent);
        console.log('✅ TsParser: Successfully extracted patterns');
        console.log('   - Patterns found:', patterns);
    } catch (e) {
        console.error('❌ TsParser failed:', e);
    }

    console.log('--- Audit Complete ---');
}

test();
