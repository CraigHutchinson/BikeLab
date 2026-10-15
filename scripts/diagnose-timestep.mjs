import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { diagnosticCase, diagnosticSummary } from './timestep-diagnostics.mjs';
import { STEPS } from '../dist/solver-config.js';

try {
  if(process.argv.length!==2)throw new Error('Usage: node scripts/diagnose-timestep.mjs');
  const root=new URL('../dist/vendor/rapier-0.21.0/',import.meta.url);
  const artifact=JSON.parse(await readFile(new URL('provenance.json',root),'utf8'));
  const moduleHash=createHash('sha256').update(await readFile(new URL('rapier.mjs',root))).digest('hex');
  if(moduleHash!==artifact.files['rapier.mjs'])throw new Error('Vendored artifact does not match its receipt.');
  const variants=[['original',{}],['one-substep',{substeps:1}],['two-substeps',{substeps:2}],
    ['eight-substeps',{substeps:8}],['four-pgs',{pgs:4}],['centered',{centered:true}],['net-force',{balanced:true}],
    ['net-force-centered',{balanced:true,centered:true}],['vertical',{vertical:true}],
    ['vertical-net-force-centered',{vertical:true,balanced:true,centered:true}]];
  const cases=[];
  for(const [name,controls] of variants)for(const dt of STEPS)
    cases.push({name,...diagnosticSummary(await diagnosticCase({...controls,dt}))});
  console.log(JSON.stringify({experiment:'bikelab-timestep-isolation-1',artifact,
    runtime:{node:process.version,platform:process.platform,arch:process.arch},
    scope:'Offline source-guided diagnosis. Net-force/centred controls preserve the axial ODE, not attachment load paths. No production-law change or solver qualification.',
    peakWindows:{early:'recorded t <= 1 s',late:'recorded t > 1 s'},cases},null,2));
} catch(error){console.error(error.message);process.exitCode=1;}
