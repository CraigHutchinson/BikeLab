// Shared equal-scale geometry renderer; no native state or simulation clock.
function element(svg, name, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  svg.append(node);
}
export function drawRiderPose(svg, reference, pose) {
  const points = [...Object.values(reference.points), ...Object.values(pose.points)];
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = Math.min(270 / (maxX - minX), 265 / (maxZ - minZ));
  const xy = p => [180 + (p[0] - (minX + maxX) / 2) * scale, 170 - (p[1] - (minZ + maxZ) / 2) * scale];
  svg.replaceChildren();
  element(svg, 'title', {}, 'Selected rider pose and reference unseated pose, equal x/z scale');
  const line = (a, b, attributes) => {const [x1,y1] = xy(a), [x2,y2] = xy(b); element(svg, 'line', {x1,y1,x2,y2,...attributes});};
  for (const [r, color, dashed] of [[reference, '#899ba7', true], [pose, '#f2b373', false]]) {
    for (const body of r.bodies) line(body.proximal, body.distal, {stroke: color, 'stroke-width': dashed ? 2 : 4,
      'stroke-dasharray': dashed ? '5 4' : 'none', 'stroke-linecap': 'round'});
    const [cx, cy] = xy(r.aggregate.com);
    element(svg, 'circle', {cx, cy, r: 6, fill: 'none', stroke: color, 'stroke-width': 2});
  }
  for (const name of ['hip', 'shoulder', 'knee', 'elbow', 'hand', 'foot']) {
    const [cx, cy] = xy(pose.points[name]);
    element(svg, 'circle', {cx, cy, r: 3, fill: ['hand','foot'].includes(name) ? '#70e2ce' : '#f2b373'});
  }
  for (const name of ['hand', 'foot']) {
    const [x, y] = xy(pose.points[name]);
    element(svg, 'text', {x: x + 9, y: y + 4, fill: '#70e2ce', 'font-size': 11}, name === 'hand' ? 'Hands' : 'Feet');
  }
  element(svg, 'text', {x: 12, y: 20, fill: '#9aabb7', 'font-size': 11}, 'x →  z ↑ · frame-local · equal scale');
  const bar = .2 * scale;
  element(svg, 'line', {x1: 12, y1: 325, x2: 12 + bar, y2: 325, stroke: '#9aabb7'});
  element(svg, 'text', {x: 18 + bar, y: 329, fill: '#9aabb7', 'font-size': 11}, '0.2 m');
}
