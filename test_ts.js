const ts = require('typescript');
const src = ts.createSourceFile('test.ts', "Then('hello\\\\()')", ts.ScriptTarget.Latest, true);
ts.forEachChild(src, node => {
    if(ts.isExpressionStatement(node)) {
        const call = node.expression;
        console.log(call.arguments[0].text);
    }
});
