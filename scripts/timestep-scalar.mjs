// Bounded diagnostic surrogate for source-derived scalar Rapier motor arithmetic.
// This is not a Rapier emulator: it omits joint frames, vector projection, other
// constraint rows, relaxation roundoff, and the engine's stored initial state.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULTS, STEPS, SAMPLE_DT } from '../dist/solver-config.js';
import { G } from '../dist/physics.js';
import { oscillatorState } from '../dist/suspension-reference.js';

const MODES = Object.freeze([
  'double', 'coefficients', 'final-velocity', 'split-velocity',
  'position-only', 'split-and-coefficients', 'combined',
]);
const identity = x => x;
const f32 = Math.fround;

// Only the default fixture and its five declared outer steps are supported.
// balanced changes the force representation, preserving the double ODE:
// gravity/preload become a spring about qeq with zero external acceleration.
export function runScalarTimestepIsolation({ balanced = false } = {}) {
  if (typeof balanced !== 'boolean') throw new Error('balanced must be boolean');
  const p = DEFAULTS;
  const acceleration = G * Math.cos(p.tiltDegrees * Math.PI / 180);
  const equilibrium = (p.mass * acceleration - p.preload) / p.stiffness;
  const reference = new Float64Array(2);
  const rows = [];
  for (const dt of STEPS) {
    const storedDt = f32(dt), h = storedDt / 4;
    const totalSubsteps = Math.round(p.duration / dt) * 4;
    const sampleStride = Math.round(SAMPLE_DT / dt) * 4;
    for (const mode of MODES) {
      const roundOperations = mode === 'split-and-coefficients' || mode === 'combined';
      const roundCoefficients = mode === 'coefficients' || roundOperations;
      const R = roundOperations ? f32 : identity;
      const C = roundCoefficients ? f32 : identity;
      const inverseMass = C(1 / p.mass);
      const denominator = C(C(h * p.stiffness) + p.damping);
      const erp = C(p.stiffness / denominator);
      const gamma = C(1 / C(h * denominator));
      const inverseLhs = C(1 / C(inverseMass + gamma));
      const target = C(balanced ? equilibrium : -p.preload / p.stiffness);
      const increment = balanced ? 0 : C(C(C(acceleration * p.mass) * inverseMass) * h);
      let q = p.initialCompression, u = p.initialVelocity;
      let maxError = -1, peakTime = 0, signedErrorAtPeak = 0;
      for (let n = 0; n <= totalSubsteps; n++) {
        if (n % sampleStride === 0) {
          const t = n * h;
          oscillatorState(p.mass, p.stiffness, p.damping,
            p.initialCompression - equilibrium, p.initialVelocity, t, reference);
          const error = q - (equilibrium + reference[0]);
          if (Math.abs(error) > maxError) {
            maxError = Math.abs(error); peakTime = t; signedErrorAtPeak = error;
          }
        }
        if (n === totalSubsteps) break;
        const star = R(u + increment);
        const rhs = R(R(q - target) * erp);
        const impulse = R(inverseLhs * R(star + rhs));
        let nextU = R(star - R(inverseMass * impulse));
        if (mode === 'split-velocity') {
          // Keep coefficients/rhs double; round the split velocity path only.
          const roundedStar = f32(u + increment);
          nextU = f32(roundedStar - f32(inverseMass
            * f32(inverseLhs * f32(roundedStar + rhs))));
        }
        if (mode === 'final-velocity') nextU = f32(nextU);
        u = nextU;
        const nextQ = q + h * u;
        // Diagnostic storage rounding only: product h*u remains double here.
        q = mode === 'position-only' || mode === 'combined' ? f32(nextQ) : nextQ;
      }
      rows.push({ dt, storedDt, substeps: 4, h, mode, balanced,
        maxCompressionError: maxError, peakTime, signedErrorAtPeak,
        finalCompression: q, finalVelocity: u });
    }
  }
  return {
    model: 'scalar-split-motor-diagnostic-1', params: p,
    scope: 'Source-derived scalar surrogate; no engine execution or bitwise emulation.',
    operations: {
      coefficients: 'K=C(1/m); D=C(C(h*k)+c); ERP=C(k/D); gamma=C(1/C(h*D)); invLhs=C(1/C(K+gamma)); target=C(r); inc=C(C(C(a*m)*K)*h)',
      split: 'star=R(u+inc); rhs=R(R(q-target)*ERP); lambda=R(invLhs*R(star+rhs)); nextU=R(star-R(K*lambda))',
      position: 'nextQ=q+h*nextU; position-only/combined apply f32 to nextQ; h*nextU is double',
      finalVelocity: 'Only nextU is rounded after the otherwise double split update',
      splitVelocity: 'Coefficients/rhs double; star=f32(u+inc); nextU=f32(star-f32(K*f32(invLhs*f32(star+rhs))))',
      limits: 'No vector/frame/constraint-relaxation rounding; authored double initial state; fixed defaults, duration and sample grid.',
    }, rows,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.slice(2).some(arg => arg !== '--balanced')) {
    throw new Error('Usage: node scripts/timestep-scalar.mjs [--balanced]');
  }
  process.stdout.write(JSON.stringify(runScalarTimestepIsolation({
    balanced: process.argv.includes('--balanced'),
  }), null, 2) + '\n');
}
