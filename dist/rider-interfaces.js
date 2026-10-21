// Instantaneous named connect diagnostics. The caller owns forward evaluation,
// native model/data lifetime and copying borrowed results into history.
export const ATTACHMENTS = Object.freeze(['hand', 'foot']);
const VECTORS = ['rider', 'bike', 'gap', 'nativeResidual', 'forceOnRider', 'riderVelocity', 'bikeVelocity',
  'momentOnRider', 'momentOnBike', 'pairMoment'];
const SCALARS = ['active', 'rows', 'powerOnRider', 'powerOnBike', 'pairPower', 'rowPower', 'powerResidual'];
const record = name => ({name, ...Object.fromEntries(VECTORS.map(key => [key, new Float64Array(3)])),
  active: false, rows: 0, powerOnRider: 0, powerOnBike: 0, pairPower: 0, rowPower: 0, powerResidual: 0});
const result = () => ({attachments: ATTACHMENTS.map(record), pairMoment: new Float64Array(3),
  pairPower: 0, rowPower: 0, powerResidual: 0, otherEqualityRows: 0});
function cross(a, b, out, sign = 1) {
  out[0] = sign * (a[1] * b[2] - a[2] * b[1]);
  out[1] = sign * (a[2] * b[0] - a[0] * b[2]);
  out[2] = sign * (a[0] * b[1] - a[1] * b[0]);
}

// Report materialization is deliberately outside the reusable observer read.
export function copyClosureReport(value) {
  return {...value, convention: 'World xyz; force on rider and its negative on bike, moments about world origin. Signed pair work is native constraint work, not an additional load. Hand/foot only; no saddle or terrain.', pairMoment: Array.from(value.pairMoment), attachments: value.attachments.map(a =>
    ({...a, ...Object.fromEntries(VECTORS.map(key => [key, Array.from(a[key])]))}))};
}

export function createRiderClosureObserver(mj, model, data) {
  const id = (kind, name) => {
    const value = mj.mj_name2id(model, mj.mjtObj[kind].value, name);
    if (value < 0) throw Error(`Missing rider interface: ${name}.`);
    return value;
  };
  const connections = ATTACHMENTS.map(name => {
    const equality = id('mjOBJ_EQUALITY', `rider_${name}_closure`);
    const rider = id('mjOBJ_SITE', `rider_${name}`), bike = id('mjOBJ_SITE', `bike_${name}`);
    const riderBody = id('mjOBJ_BODY', name === 'hand' ? 'rider_forearmsHands' : 'rider_shanksFeet');
    const bikeBody = id('mjOBJ_BODY', 'frame');
    if (model.eq_type[equality] !== mj.mjtEq.mjEQ_CONNECT.value ||
        model.eq_objtype[equality] !== mj.mjtObj.mjOBJ_SITE.value ||
        model.eq_obj1id[equality] !== rider || model.eq_obj2id[equality] !== bike ||
        model.site_bodyid[rider] !== riderBody || model.site_bodyid[bike] !== bikeBody ||
        model.body_mocapid[riderBody] >= 0 || model.body_mocapid[bikeBody] >= 0) {
      throw Error(`Expected rider-first site connect for ${name}.`);
    }
    return {equality, rider, bike, firstRow: -1};
  });
  const output = result(), pending = result(), velocity = new mj.DoubleBuffer(6);
  const equalityType = mj.mjtConstraint.mjCNSTR_EQUALITY.value, siteType = mj.mjtObj.mjOBJ_SITE.value;
  const disabled = mj.mjtDisableBit.mjDSBL_CONSTRAINT.value | mj.mjtDisableBit.mjDSBL_EQUALITY.value;
  let deleted = false;
  function siteVelocity(site, out) {
    mj.mj_objectVelocity(model, data, siteType, site, velocity, 0);
    const view = velocity.GetView();
    for (let axis = 0; axis < 3; axis++) out[axis] = view[3 + axis];
  }
  return {
    read() {
      if (deleted) throw Error('Rider interface observer is deleted.');
      // Sleeping equalities can omit rows while enabled. No sleeping receiving
      // case exists yet; reject it rather than mislabeling missing loads released.
      if (model.opt.enableflags & mj.mjtEnableBit.mjENBL_SLEEP.value) throw Error('Sleeping rider interfaces are unsupported.');
      const enabled = !(model.opt.disableflags & disabled), active = data.eq_active;
      for (let i = 0; i < connections.length; i++) {
        const a = pending.attachments[i];
        a.active = enabled && !!active[connections[i].equality]; a.rows = 0; a.rowPower = 0;
        a.forceOnRider.fill(0); a.nativeResidual.fill(0); connections[i].firstRow = -1;
      }
      pending.otherEqualityRows = 0;
      // Views are local to this read phase; no native call occurs during scanning.
      const types = data.efc_type, ids = data.efc_id, forces = data.efc_force, speeds = data.efc_vel, residuals = data.efc_pos;
      for (let row = 0; row < data.nefc; row++) {
        if (types[row] !== equalityType) continue;
        const index = ids[row] === connections[0].equality ? 0 : ids[row] === connections[1].equality ? 1 : -1;
        if (index < 0) {pending.otherEqualityRows++; continue;}
        const a = pending.attachments[index], connection = connections[index], axis = a.rows;
        if (!axis) connection.firstRow = row;
        if (!a.active || axis >= 3 || row !== connection.firstRow + axis) throw Error('Malformed rider connect rows.');
        a.forceOnRider[axis] = forces[row]; a.nativeResidual[axis] = residuals[row];
        a.rowPower += forces[row] * speeds[row]; a.rows++;
      }
      for (let i = 0; i < connections.length; i++) {
        const a = pending.attachments[i], c = connections[i];
        if (a.rows !== (a.active ? 3 : 0)) throw Error('Missing rider connect rows; refresh the complete native state.');
        const positions = data.site_xpos;
        for (let axis = 0; axis < 3; axis++) {
          a.rider[axis] = positions[3 * c.rider + axis]; a.bike[axis] = positions[3 * c.bike + axis];
          a.gap[axis] = a.rider[axis] - a.bike[axis];
        }
        siteVelocity(c.rider, a.riderVelocity); siteVelocity(c.bike, a.bikeVelocity);
        cross(a.rider, a.forceOnRider, a.momentOnRider);
        cross(a.bike, a.forceOnRider, a.momentOnBike, -1);
        cross(a.gap, a.forceOnRider, a.pairMoment);
        a.powerOnRider = 0; a.powerOnBike = 0; a.pairPower = 0;
        for (let axis = 0; axis < 3; axis++) {
          a.powerOnRider += a.forceOnRider[axis] * a.riderVelocity[axis];
          a.powerOnBike -= a.forceOnRider[axis] * a.bikeVelocity[axis];
          a.pairPower += a.forceOnRider[axis] * (a.riderVelocity[axis] - a.bikeVelocity[axis]);
        }
        a.powerResidual = a.pairPower - a.rowPower;
        for (const key of VECTORS) for (let axis = 0; axis < 3; axis++) {
          if (!Number.isFinite(a[key][axis])) throw Error('Nonfinite rider interface state.');
        }
        for (const key of SCALARS) if (key !== 'active' && !Number.isFinite(a[key])) throw Error('Nonfinite rider interface load.');
      }
      pending.pairMoment.fill(0); pending.pairPower = 0; pending.rowPower = 0;
      for (const a of pending.attachments) {
        for (let axis = 0; axis < 3; axis++) pending.pairMoment[axis] += a.pairMoment[axis];
        pending.pairPower += a.pairPower; pending.rowPower += a.rowPower;
      }
      pending.powerResidual = pending.pairPower - pending.rowPower;
      if (!pending.pairMoment.every(Number.isFinite) || !Number.isFinite(pending.pairPower) ||
          !Number.isFinite(pending.rowPower) || !Number.isFinite(pending.powerResidual)) throw Error('Nonfinite rider interface total.');
      // Publish only after the complete read passes; failure preserves the last result.
      for (let i = 0; i < connections.length; i++) {
        for (const key of VECTORS) output.attachments[i][key].set(pending.attachments[i][key]);
        for (const key of SCALARS) output.attachments[i][key] = pending.attachments[i][key];
      }
      output.pairMoment.set(pending.pairMoment); output.pairPower = pending.pairPower; output.rowPower = pending.rowPower;
      output.powerResidual = pending.powerResidual; output.otherEqualityRows = pending.otherEqualityRows;
      return output;
    },
    delete() {if (!deleted) {velocity.delete(); deleted = true;}}
  };
}
