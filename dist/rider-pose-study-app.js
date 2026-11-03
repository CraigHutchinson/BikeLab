import {drawRiderPose} from './rider-pose-view.js';
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
function preview() {
  try {
    const values = fields.map(field => field.value.trim() ? Number(field.value) : NaN);
    const report = inspectRiderPose({hip: values.slice(0, 2), trunkPitch: values[2]});
    const p = report.posture;
    drawRiderPose($('poseView'),reference,p);
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
