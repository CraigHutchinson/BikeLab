# Rear shock travel buffers

Optional progressive shock buffers complete the coupled rig's first fork/rear travel-buffer pair. The hardtail remains rigid. These are illustrative compliant forces inside the original 65 mm stroke; ultimate shock/angle bounds still terminate unsupported motion. They are not calibrated elastomers, rigid impacts or damage criteria.

## Geometry and work

Let theta be swing rotation about local +y, L(theta) the distance between the existing shock eyes, and s=L(0)-L(theta) positive compression. The geometry helper computes j=ds/dtheta analytically from the derivative of the two-dimensional eye separation. It changes from about 0.1777 m/rad at zero swing toward 0.199 m/rad at 0.4 rad; no constant leverage factor is used. The original 65 mm shock bound is reached before the 0.4 rad angle bound.

The existing travelBuffer law takes s and sdot=-tendon velocity. Its compression-positive force B=Ft-Fb maps to swing generalized moment Q=B*j. Thus Q*thetaDot=B*sdot=-Udot-D. Apply Q once at the named swing coordinate. The articulated system supplies the internal frame reaction; no duplicate Cartesian shock/wheel force is added. This direct mapping is valid for the fixed two-eye single-pivot geometry. Changed linkage topology requires a new derived/verified mapping.

Native spring/damper energy and damping remain in their existing ledgers. Add custom buffer potential and dissipation once, including during settling. The force is held explicitly over each native implicitfast step. Continuous passivity is not a claim of exact discrete conservation. End-point guards remain discrete, not event-location or rigid containment guarantees.

| Setting | Default | Admitted range |
|---|---:|---|
| shockBuffer | none | none / progressive |
| shockBufferWidth | 0.008 m | 0.002–0.012 m |
| shockBufferStiffness | 1,000,000 N/m | 100,000–4,000,000 N/m |
| shockBufferDamping | 3,000 N s/m | 0–12,000 N s/m |

Spring scale means F=k*d²/width, not constant tangent stiffness. Damping acts only while entering a buffer. Zones do not overlap. Hardtail records preserve and validate dormant settings, but all shock channels remain zero and the UI labels them unavailable. Arbitrary admitted combinations can fail settling or travel limits; the tested presets define the demonstrated domain.

## Records and viewer

Model v0.4 requires shock-buffer fields. Complete v0.1/v0.2/v0.3 records explicitly migrate with shock buffers disabled; v0.3 preserves fork buffers, v0.2 preserves rider settings, v0.1 becomes fixed rider. Unknown fields still reject and imported samples are not trusted.

New channels are shockBufferForce (compression-positive N), shockTopForce/shockBottomForce (positive magnitudes), shockBufferMoment (positive swing-compression N m), shockLeverage (ds/dtheta, m/rad), shockBufferEnergy (J) and shockBufferDissipation (J). Existing shockForce is the spring/damper extension-positive axial force; shockTotalForce=shockForce-shockBufferForce includes the buffer in that convention. This axial force is not the complete frame/pivot attachment wrench. Summary peaks inspect every accepted integration endpoint independently of graph cadence.

Both rear-only presets use 80 mm / 0.2 s excitation, shock damping 900 N s/m and progressive fork/shock buffers. Top-out uses shock spring 70,000 N/m; bottom-out uses 30,000 N/m. With identical forcing the top-out unbuffered/weak-buffer control terminates; the bottom-out unbuffered control can complete, so completion alone is not proof of bottom-buffer action. The viewer shows signed force, engagement, swing moment, total axial shock force and stored/lost energy, with an orange shock under buffer load.

## Verification and limits

[Iteration review](ITERATION_10_REVIEW.md) identifies broader configuration/model gaps. [Evidence](ITERATION_10_EVIDENCE.md) records this bounded slice. The derivative is independently compared with centered differences and the vendored MuJoCo 3.16.0 tendon Jacobian across angles, pitch, heave and nonzero frame rates. In that binding ten_J is structurally compressed with model-owned row/column metadata even for this small dense solve; the verification iterates that metadata. No generic dense-layout assumption enters production.

The buffer law and native force/energy references are retained in [fork buffers](FORK_BUFFERS.md#sources-and-verification). This new geometry mapping follows virtual work directly and is not a fitted external linkage model. Source-backed production-bike geometry, nonlinear suspension, anatomical attachments, rotating wheels and braking/3D handling remain separate receiving work.
