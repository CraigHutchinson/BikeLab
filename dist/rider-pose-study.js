// Independent geometry study. Never a trajectory or a seated-support classifier.
import {constructPosture} from './rider-posture.js';
import {compilePassiveRider, DEFAULTS, JOINTS} from './rider-passive.js';

export const POSE_EXAMPLES = Object.freeze([
  ['reference', 'Reference unseated', [-.15, .25], .55],
  ['taller', 'Taller unseated', [-.13, .29], .60],
  ['hover', 'Bent-leg hover', [-.20, .17], .75],
  ['seating', 'Low-hip seating intent · no saddle', [-.22, .07], .65]
].map(([id, label, hip, trunkPitch]) => Object.freeze({id, label,
  posture: Object.freeze({hip: Object.freeze(hip), trunkPitch})})));

export function inspectRiderPose(input = {}) {
  // Reachability/bend failures reject the entire preview. A geometrically valid
  // pose can still fail the existing, deliberately narrow passive law envelope.
  const posture = constructPosture(input);
  let accepted = true, reason = null;
  try { compilePassiveRider({posture: posture.spec}); }
  catch (error) { accepted = false; reason = error.message; }
  return Object.freeze({posture,
    defaultPassive: Object.freeze({accepted, reason}),
    joints: Object.freeze(JOINTS.map(name => Object.freeze({name, angle: posture.joints[name],
      min: DEFAULTS.joints[name].minAngle, max: DEFAULTS.joints[name].maxAngle})))
  });
}
