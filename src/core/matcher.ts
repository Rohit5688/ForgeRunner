import { 
    CucumberExpression, 
    RegularExpression, 
    ParameterTypeRegistry 
} from '@cucumber/cucumber-expressions';
import { injectable } from 'inversify';

export interface MatchResult {
    isMatch: boolean;
    args: any[];
}

@injectable()
export class MatchEngine {
    private parameterRegistry = new ParameterTypeRegistry();

    /**
     * Matches a step text against a step definition pattern.
     * Supports both Cucumber Expressions and Regular Expressions.
     */
    public match(stepText: string, pattern: string): MatchResult {
        try {
            // Try Cucumber Expression first
            const expression = new CucumberExpression(pattern, this.parameterRegistry);
            const matches = expression.match(stepText);
            
            if (matches) {
                return {
                    isMatch: true,
                    args: matches.map(m => m.getValue(null))
                };
            }
        } catch (e) {
            // If failed, it might be a Regular Expression
            try {
                let finalRegex: RegExp;
                
                // Properly extract regex body and flags from literal instances like /pattern/ig
                const regexMatch = pattern.match(/^\/(.*)\/([a-z]*)$/);
                if (regexMatch) {
                    finalRegex = new RegExp(regexMatch[1], regexMatch[2]);
                } else {
                    finalRegex = new RegExp(pattern);
                }
                
                const regex = new RegularExpression(finalRegex, this.parameterRegistry);
                const matches = regex.match(stepText);
                
                if (matches) {
                    return {
                        isMatch: true,
                        args: matches.map(m => m.getValue(null))
                    };
                }
            } catch (innerError) {
                // Invalid regex construction
            }
        }

        // Absolute Last Resort Fallback: Exact Verbatim Literal String
        // This flawlessly handles unescaped strict special chars like !@#$%^&*() that break Cucumber parsing entirely
        if (pattern === stepText || pattern.replace(/\\/g, '') === stepText) {
            return { isMatch: true, args: [] };
        }

        return { isMatch: false, args: [] };
    }
}
