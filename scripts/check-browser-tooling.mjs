import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
let version;
try { version = require('playwright/package.json').version; }
catch { version = require('playwright-core/package.json').version; }
if (version !== '1.56.1') throw new Error(`Expected Playwright 1.56.1, found ${version}`);
console.log(`Playwright ${version}; browser executable/version is recorded by browser-check.mjs`);
