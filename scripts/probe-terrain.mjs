import { readFile } from 'node:fs/promises';
import { fixture, parseProfile, probe } from '../dist/terrain.js';

try {
  const args = process.argv.slice(2);
  if (![0,1,4].includes(args.length)) throw new Error('Usage: node scripts/probe-terrain.mjs [profile.json [x_m z_m radius_m]]');
  const profile = args.length ? parseProfile(await readFile(args[0],'utf8')) : fixture();
  const values = args.length === 4 ? args.slice(1).map(s => s.trim() ? Number(s) : NaN) : [-.2,.36,.36];
  const result = probe(profile,{center:values.slice(0,2),radius:values[2]});
  console.log(JSON.stringify(result,null,2));
  if (result.status !== 'available') process.exitCode = 2;
} catch (error) { console.error(error.message); process.exitCode = 1; }
