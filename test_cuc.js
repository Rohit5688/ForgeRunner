const { CucumberExpression, ParameterTypeRegistry } = require('@cucumber/cucumber-expressions');
try {
    const expr = new CucumberExpression("I should see special characters like !@#$%^&*\\()", new ParameterTypeRegistry());
    console.log("Match:", expr.match("I should see special characters like !@#$%^&*()"));
} catch(e) {
    console.log("Error:", e.message);
}
