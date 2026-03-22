import * as assert from 'assert';
import { GherkinParser } from '../../parsers/gherkinParser.js';

suite('GherkinParser Test Suite', () => {
    const parser = new GherkinParser();

    test('Should parse simple feature file', async () => {
        const featureContent = `
Feature: Sample Feature
  Scenario: Simple Scenario
    Given I have a step
    When I perform an action
    Then I see the result
        `;
        const result = await parser.parse('sample.feature', featureContent);
        assert.ok(result, 'Feature should be parsed');
        assert.strictEqual(result.name, 'Sample Feature');
        assert.strictEqual(result.scenarios.length, 1);
    });

    test('Should handle parse errors gracefully', async () => {
        const invalidContent = `Feature: Incomplete`;
        try {
            await parser.parse('error.feature', invalidContent);
        } catch (e) {
            assert.ok(e, 'Should throw error on invalid content');
        }
    });
});
