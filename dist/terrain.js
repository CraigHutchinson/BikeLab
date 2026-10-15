// Geometry only. See docs/TERRAIN_PROBE.md for conventions and applicability.
export const PROFILE = 'bikelab-profile-1';
export const PROBE = 'bikelab-clearance-1';
export const MAX_PROFILE_BYTES = 256 * 1024;
export const TIE_TOLERANCE = 1e-10; // metres; not a collision margin

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new Error('Unsupported ' + label + ' field: ' + key);
  for (const key of keys) if (!Object.hasOwn(value, key)) throw new Error('Missing ' + label + ' field: ' + key);
}
function point(p) {
  if (!Array.isArray(p) || p.length !== 2 || !p.every(v => Number.isFinite(v) && Math.abs(v) <= 1000))
    throw new Error('Each point must contain finite [x, z] metres within ±1000 m.');
}
export function validateProfile(profile) {
  object(profile, ['format','units','axes','solid','interpolation','source','points'], 'profile');
  for (const [key, value] of Object.entries({format:PROFILE, units:'m', axes:'x-forward,z-up', solid:'below', interpolation:'linear'}))
    if (profile[key] !== value) throw new Error('Unsupported profile ' + key + '; expected ' + value + '.');
  object(profile.source, ['kind','description'], 'source');
  if (!['illustrative','measured','synthetic'].includes(profile.source.kind)) throw new Error('Unsupported source kind.');
  if (typeof profile.source.description !== 'string' || !profile.source.description.trim() || profile.source.description.length > 1000)
    throw new Error('Source description must contain 1–1000 characters.');
  const points = profile.points;
  if (!Array.isArray(points) || points.length < 2 || points.length > 2048) throw new Error('Profile requires 2–2048 ordered points.');
  for (let i = 0; i < points.length; i++) {
    point(points[i]);
    if (!i) continue;
    const dx = points[i][0] - points[i-1][0], dz = points[i][1] - points[i-1][1];
    if (dx < 0) throw new Error('Profile x coordinates must be nondecreasing; overhangs are unsupported.');
    if (Math.hypot(dx,dz) < 1e-6) throw new Error('Profile segments must be at least 1 micrometre long.');
    if (i > 1 && dx === 0 && points[i-1][0] === points[i-2][0] && dz * (points[i-1][1]-points[i-2][1]) < 0)
      throw new Error('Vertical segments must not reverse or overlap.');
  }
  if (points.at(-1)[0] - points[0][0] < 1e-6) throw new Error('Profile must span a horizontal domain.');
  return profile;
}
export function parseProfile(text) {
  if (typeof text !== 'string' || text.length > MAX_PROFILE_BYTES || new TextEncoder().encode(text).length > MAX_PROFILE_BYTES)
    throw new Error('Profile exceeds 256 KiB.');
  return validateProfile(JSON.parse(text.replace(/^\uFEFF/, '')));
}
export function fixture(name = 'square', subdivisions = 32) {
  let points;
  if (name === 'flat') points = [[-1,0],[1,0]];
  else if (name === 'square') points = [[-1,0],[0,0],[0,.1],[.2,.1],[.2,0],[1,0]];
  else if (name === 'rounded') {
    if (!Number.isInteger(subdivisions) || subdivisions < 4 || subdivisions > 1024) throw new Error('Rounded fixture needs 4–1024 segments.');
    points = [[-1,0],[0,0]];
    for (let i = 1; i < subdivisions; i++) {
      const angle = Math.PI * (1-i/subdivisions);
      points.push([.1+.1*Math.cos(angle), .1*Math.sin(angle)]);
    }
    points.push([.2,0],[1,0]);
  } else throw new Error('Unknown fixture: ' + name);
  return {format:PROFILE, units:'m', axes:'x-forward,z-up', solid:'below', interpolation:'linear',
    source:{kind:'illustrative',description:name === 'rounded' ? 'Synthetic 0.1 m radius semicircle sampled with '+subdivisions+' straight segments.' : 'Synthetic '+name+' rigid reference surface.'}, points};
}

export function probe(profile, setup) {
  validateProfile(profile);
  object(setup, ['center','radius'], 'probe'); point(setup.center);
  if (!Number.isFinite(setup.radius) || setup.radius < .01 || setup.radius > 2) throw new Error('Circle radius must be 0.01–2 m.');
  const [cx,cz] = setup.center, r = setup.radius, points = profile.points;
  // Own the report data: later caller edits cannot change saved evidence.
  const report = {model:PROBE, profile:structuredClone(profile), setup:structuredClone(setup), tieTolerance:TIE_TOLERANCE};
  const unavailable = reason => ({...report,status:'unavailable',reason});
  if (cx-r < points[0][0] || cx+r > points.at(-1)[0])
    return unavailable('Circle footprint leaves the authored domain; terrain is not extrapolated.');
  let surface = -Infinity, distance = Infinity;
  const candidates = [];
  for (let i = 0; i < points.length-1; i++) {
    const [ax,az] = points[i], [bx,bz] = points[i+1], dx = bx-ax, dz = bz-az;
    if (cx >= ax && cx <= bx) surface = Math.max(surface, dx === 0 ? Math.max(az,bz) : az+(cx-ax)*dz/dx);
    const t = Math.max(0,Math.min(1,((cx-ax)*dx+(cz-az)*dz)/(dx*dx+dz*dz)));
    const x = ax+t*dx, z = az+t*dz, d = Math.hypot(cx-x,cz-z);
    const feature = t === 0 ? {kind:'vertex',index:i} : t === 1 ? {kind:'vertex',index:i+1} : {kind:'segment',index:i};
    candidates.push({point:[x,z],distance:d,feature}); distance = Math.min(distance,d);
  }
  if (distance <= TIE_TOLERANCE) return unavailable('Centre lies on the boundary; approach normal is undefined within tolerance.');
  if (cz < surface) return unavailable('Centre is inside terrain; buried-circle contact is unsupported.');
  const seen = new Set(), witnesses = [];
  for (const c of candidates) {
    if (c.distance-distance > TIE_TOLERANCE) continue;
    const id = c.feature.kind + ':' + c.feature.index;
    if (seen.has(id)) continue;
    seen.add(id);
    witnesses.push({point:c.point,normal:[(cx-c.point[0])/c.distance,(cz-c.point[1])/c.distance],feature:c.feature});
  }
  return {...report,status:'available',distance,gap:distance-r,witnesses};
}
