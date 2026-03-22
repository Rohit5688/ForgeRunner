const { TsParser } = require('./out/parsers/tsParser.js');
const fs = require('fs');

const parser = new TsParser();
const content = fs.readFileSync('C:\\Users\\Rohit\\git\\playwright-bdd-runner\\src\\steps\\reproduce_issue.ts', 'utf8');
const definitions = parser.parseContent(content);
console.log(definitions.find(d => d.includes('special characters')));
