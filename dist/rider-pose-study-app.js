import {POSE_EXAMPLES, inspectRiderPose} from './rider-pose-study.js';

// Own only this panel. In particular, do not edit scenario, playback or native state.
const $ = id => document.getElementById(id), choice = $('poseExample');
const fields = ['poseHipX', 'poseHipZ', 'posePitch'].map($);
const reference = inspectRiderPose().posture;
let accepted;
for (const example of POSE_EXAMPLES) choice.add(new Option(example.label, example.id));

function invalidate(message) {
  accepted = null;
  $('poseResult').hidden = true;
  $('savePose').disabled = true;
  $('poseStatus').textContent = message;
}
function element(name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  $('poseView').append(node);
}
function draw(pose) {
  const points = [...Object.values(reference.points), ...Object.values(pose.points)];
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = Math.min(270 / (maxX - minX), 265 / (maxZ - minZ));
  const xy = p => [180 + (p[0] - (minX + maxX) / 2) * scale, 170 - (p[1] - (minZ + maxZ) / 2) * scale];
  $('poseView').replaceChildren();
  element('title', {}, 'Selected rider pose and reference unseated pose, equal x/z scale');
  const line = (a, b, attributes) => {const [x1,y1] = xy(a), [x2,y2] = xy(b); element('line', {x1,y1,x2,y2,...attributes});};
  for (const [r, color, dashed] of [[reference, '#899ba7', true], [pose, '#f2b373', false]]) {
    for (const body of r.bodies) line(body.proximal, body.distal, {stroke: color, 'stroke-width': dashed ? 2 : 4,
      'stroke-dasharray': dashed ? '5 4' : 'none', 'stroke-linecap': 'round'});
    const [cx, cy] = xy(r.aggregate.com);
    element('circle', {cx, cy, r: 6, fill: 'none', stroke: color, 'stroke-width': 2});
  }
  for (const name of ['hip', 'shoulder', 'knee', 'elbow', 'hand', 'foot']) {
    const [cx, cy] = xy(pose.points[name]);
    element('circle', {cx, cy, r: 3, fill: ['hand','foot'].includes(name) ? '#70e2ce' : '#f2b373'});
  }
  for (const name of ['hand', 'foot']) {
    const [x, y] = xy(pose.points[name]);
    element('text', {x: x + 9, y: y + 4, fill: '#70e2ce', 'font-size': 11}, name === 'hand' ? 'Hands' : 'Feet');
  }
  element('text', {x: 12, y: 20, fill: '#9aabb7', 'font-size': 11}, 'x →  z ↑ · frame-local · equal scale');
  const bar = .2 * scale;
  element('line', {x1: 12, y1: 325, x2: 12 + bar, y2: 325, stroke: '#9aabb7'});
  element('text', {x: 18 + bar, y: 329, fill: '#9aabb7', 'font-size': 11}, '0.2 m');
}
function preview() {
  try {
    const values = fields.map(field => field.value.trim() ? Number(field.value) : NaN);
    const report = inspectRiderPose({hip: values.slice(0, 2), trunkPitch: values[2]});
    const p = report.posture;
    draw(p);
    $('poseCom').textContent = p.aggregate.com.map(n => n.toFixed(3)).join(' / ') + ' m';
    $('poseComChange').textContent = p.aggregate.com.map((n,i) => (1000 * (n - reference.aggregate.com[i])).toFixed(1)).join(' / ') + ' mm';
    $('poseDomain').textContent = report.defaultPassive.accepted
      ? 'Within the default passive joint domains at this pose. This does not establish equilibrium or a supported motion.'
      : 'Outside the default passive model: ' + report.defaultPassive.reason;
    $('poseAngles').replaceChildren();
    for (const joint of report.joints) {
      const row = document.createElement('tr');
      for (const value of [joint.name, joint.angle.toFixed(3), joint.min.toFixed(3) + ' to ' + joint.max.toFixed(3)]) {
        const cell = document.createElement(row.children.length ? 'td' : 'th');
        if (!row.children.length) cell.scope = 'row';
        cell.textContent = value; row.append(cell);
      }
      if (joint.angle < joint.min || joint.angle > joint.max) row.className = 'exceeds';
      $('poseAngles').append(row);
    }
    accepted = p.spec;
    $('poseResult').hidden = false; $('savePose').disabled = false;
    $('poseStatus').textContent = 'Geometry preview · no support or transition simulated';
  } catch (error) { invalidate('Pose rejected: ' + error.message); }
}
function selectExample() {
  const example = POSE_EXAMPLES.find(p => p.id === choice.value);
  if (!example) return;
  [fields[0].value, fields[1].value] = example.posture.hip;
  fields[2].value = example.posture.trunkPitch;
  preview();
}
choice.onchange = selectExample;
for (const field of fields) field.oninput = () => {choice.value = 'custom'; invalidate('Unapplied pose edits');};
$('previewPose').onclick = preview;
$('savePose').onclick = () => {
  if (!accepted) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(accepted, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'bikelab-rider-posture.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
choice.value = 'reference'; selectExample();
