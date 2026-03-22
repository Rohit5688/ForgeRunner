const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts')) { 
            results.push(file);
        }
    });
    return results;
}

walk('src').forEach(f => {
    let c = fs.readFileSync(f, 'utf8');
    let changed = false;
    
    if (c.includes("import { TYPES } from '../core/container.js'")) { c = c.split("import { TYPES } from '../core/container.js'").join("import { TYPES } from '../core/types.js'"); changed = true; }
    if (c.includes("import { TYPES } from '../../core/container.js'")) { c = c.split("import { TYPES } from '../../core/container.js'").join("import { TYPES } from '../../core/types.js'"); changed = true; }
    if (c.includes("import { container, TYPES } from './core/container.js'")) { c = c.split("import { container, TYPES } from './core/container.js'").join("import { container } from './core/container.js';\nimport { TYPES } from './core/types.js'"); changed = true; }
    if (c.includes("import { TYPES } from '../container.js'")) { c = c.split("import { TYPES } from '../container.js'").join("import { TYPES } from '../types.js'"); changed = true; }
    if (c.includes("import { TYPES } from './container.js'")) { c = c.split("import { TYPES } from './container.js'").join("import { TYPES } from './types.js'"); changed = true; }
    
    if (changed) { fs.writeFileSync(f, c); console.log('Updated ' + f); }
});
