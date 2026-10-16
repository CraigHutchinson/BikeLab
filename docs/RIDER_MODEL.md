# Passive guided rider

The bicycle station now offers **Fixed rider · baseline** and **Passive guided rider** for both assemblies. The same `runRig` path serves the worker, CLI and saved-run reconstruction. This is one passive guided mass, not anatomical rider articulation, active control or a human-load calibration. [Research](RIDER_RESEARCH.md) records the primary MuJoCo source and mechanical derivations; [iteration scope](ITERATION_7_REVIEW.md) fixes the numerical gates.

## Mass, geometry and force ownership

`mass` remains the total frame-plus-rider budget. Fixed mode uses the original lump at the frame origin, with spherical diagonal inertia 8 kg m² and no rider coordinate. Compliant mode uses frame mass `mass-riderMass` and rider mass `riderMass`; the existing 3 kg front and 4 kg rear assemblies remain separate. At defaults the masses are 12+70+3+4=89 kg. Editing rider mass redistributes a fixed total; editing total mass changes weight. At least 5 kg must remain in the frame.

Both unloaded COMs coincide at the original frame origin. Each body's spherical inertia is its mass fraction of 8 kg m². A rigid rider child at zero displacement therefore recovers the original mass matrix and gravity vector. These are synthetic inertias and geometry, not inferred body proportions. Actual gravitational sag moves the rider COM and changes the coupled mass distribution.

The rider is a native frame-child prismatic joint along local +z. Its world axis is `(sin(pitch),0,cos(pitch))`; positive frame pitch is nose-down about +y. The child retains the frame orientation. Let q be upward relative displacement, u its rate. Spring rest is q=0; reported compression and compression velocity are `s=-q`, `sdot=-u`. The native spring/damper supplies axial force on the rider `F=-k*q-c*u=k*s+c*sdot`, positive up the guide. The frame receives the internal opposite reaction through the articulated solve. No external rider force or second spring is applied.

The guide also transmits transverse forces and a rotation couple. `riderForce` is **axial spring/damper force only**, not the full guide wrench, a pedal/saddle/handlebar load, or an injury criterion. The viewer shows a guide and a lump at its actual recorded world COM. It does not draw unmodelled limbs or imply anatomical attachments.

## Configuration and supported domain

| Parameter | Default | Admitted values |
|---|---:|---|
| `rider` | `fixed` | `fixed`, `compliant` |
| `riderMass` | 70 kg | 20–100 kg, leaving ≥5 kg frame mass when compliant |
| `riderStiffness` | 12,000 N/m | 4,000–40,000 N/m |
| `riderDamping` | 900 N s/m | 0–3,000 N s/m |
| `riderTravel` | 0.15 m | 0.02–0.25 m each side of unloaded rest |

Fixed mode validates parameter types/ranges but does not consume the rider mass split, spring, damping or travel. Thus an old 40 kg fixed setup remains valid with dormant default riderMass=70 kg. All controls are illustrative and bounded; not every admitted combination settles or completes.

Compliant initialization uses `q=-riderMass*g*cos(initialPitch)/k`, followed by the same four-second physical settling calculation and speed gate as the existing rig. No extra damping or gravity compensation is added. Every settling and excitation endpoint must satisfy `abs(q)<=riderTravel`, alongside the original fork, shock, tyre and pitch domains. If a trial violates the domain, the run ends at its last valid endpoint and records the rejected trial separately. It does not clamp geometry, apply unmodelled stop forces or continue through damage. This is endpoint checking, not continuous event location or a general guarantee about within-step excursions.

## Energy, records and display

MuJoCo includes rider gravitational, kinetic and joint spring energy in the native energy calculation. BikeLab adds rider damping loss `c*u²` once to the existing endpoint quadrature. The spring force pair has total power `F*u=-d(0.5*k*q²)/dt-c*u²`; the ideal guide's constraint power cancels between the bodies. Only platen work is external. `riderDissipation` and `summary.riderLoss` identify the rider's share of total loss; `summary.peakRiderForce` is the maximum absolute axial force across all accepted integration endpoints, independent of recording cadence.

The rider mechanism introduced model `bikelab-planar-rig-0.2`; the current model is `bikelab-planar-rig-0.3` with optional [fork buffers](FORK_BUFFERS.md). Complete v0.2 records migrate with buffers disabled and preserve their rider settings. New complete records require all rider settings, and record effective mass/inertia/guide metadata, initial generalized state, rider world COM, compression, compression rate, signed axial force and loss. Fixed mode uses zero relative rider channels and the frame world COM; its axial force is unresolved, not physically zero. The viewer labels it “Not resolved” and leaves the corresponding graphs unavailable.

Complete `bikelab-planar-rig-0.1` records migrate explicitly to fixed mode. Unknown old fields are rejected. Samples are never trusted on import: the setup is validated and rerun. A valid imported integration step outside the short preset list receives its own selectable option; a 0.1 ms legacy case is covered by browser interaction. The viewer retains its existing 5 ms recording requirement; headless runs can use the admitted recording cadences.

Both modes retain 3/4 original hardtail/full-suspension coordinates; compliant mode adds one, producing 4/5. The rider child is appended after the original topology; its coordinate addresses are resolved by joint name. No extra rear joint appears on the hardtail.

## Limits and next received mechanism

These checks qualify an illustrative smooth-platen experiment, not a full parameter rectangle or real-bike response. The exact fixed baseline, locked-split control, independent oscillator, weight/moment/sag balance, work budget, refinement and browser/headless checks are recorded in ITERATION_7_EVIDENCE.md. No real-time performance claim follows from offline replay.

Independent rider orientation, hand/foot/saddle contacts, posture and active control remain open. Next prioritize a visible, independently checked travel-stop/load-path experiment before high-impact continuation. Rim/spoke/frame failure and deformation-induced tubeless leakage need actual component criteria and observable attachment wrenches. Spatial square-edge/round/flat contact, layered soil/root and retained mud, scanned/generated trail detail, adaptive multirate execution and full 3D lateral/turning dynamics remain required future work.
