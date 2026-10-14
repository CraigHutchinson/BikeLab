import { simulate, serialize } from '../dist/physics.js';
import { readFile, writeFile } from 'node:fs/promises';
const params = process.argv[2] ? JSON.parse(await readFile(process.argv[2], 'utf8')) : {};
const run = simulate(params);
if (process.argv[3]) await writeFile(process.argv[3], serialize(run));
console.log(JSON.stringify({ model: run.model, params: run.params, metrics: run.metrics, events: run.events }, null, 2));

