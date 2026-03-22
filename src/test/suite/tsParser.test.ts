import * as assert from 'assert';
import { TsParser } from '../../parsers/tsParser.js';
import * as path from 'path';

suite('TsParser Test Suite', () => {
    const parser = new TsParser();

    test('Should extract step definitions from TS content', async () => {
        const tsContent = `
            import { Given, When, Then } from '@cucumber/cucumber';
            Given('I have a step', async () => {});
            When('I perform {string} action', async (action: string) => {});
        `;
        // In a real test, we'd write this to a temp file
        // For now, testing the parsing of the pattern
        const patterns = parser.parseContent(tsContent);
        assert.ok(patterns.includes('I have a step'));
        assert.ok(patterns.includes('I perform {string} action'));
    });
});
