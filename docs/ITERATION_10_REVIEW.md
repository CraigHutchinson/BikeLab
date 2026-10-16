# Iteration 10: rear suspension dynamics and configuration review

Reviewed merged main de785d2 and iterations 8/9 before editing. Terrain remains a separate station; this iteration receives rear-shock buffers in the existing coupled bicycle.

## Gaps and selected slice

The fork has finite travel buffers, while the rear shock terminates without them. Receive optional top/bottom shock buffers through the actual shock-length derivative, with visible signed axial force, swing moment, stored/lost energy and presets. Keep hardtail rigid and preserve existing no-buffer channels. No constant rear leverage approximation or duplicated frame force is allowed.

Configuration gaps remain explicit: frame/axle/pivot/shock geometry and inertias are illustrative fixed constants; total frame/rider mass is configurable but rider posture/COM and anatomical attachments are absent; suspension is linear without preload/air-volume/friction/thermal/hydraulic detail; tyre inflation/tread/carcass do not yet drive the vertical surrogate; wheel spin, braking/drivetrain, free horizontal motion and steering/3D handling are absent. Production-bike presets require sourced geometry, mass and suspension data, not brand names on these constants. Follow shock buffers with a received sag/load/leverage configuration view and sourced geometry controls, then rider attachment forces. Calibration and damage remain separate gates.

## Receiving gates

Use the established illustrative buffer potential and closing-only damping in shock-compression coordinates. Map axial force by virtual work through ds/dtheta, where s=L(0)-L(theta). Native internal reaction comes from the articulated coordinate. Add custom potential and loss once; native shock spring/damper remain unchanged. Custom forces remain explicitly held per native step.

Before merge: independent finite-difference length derivative and potential-gradient/virtual-work checks across travel; no-buffer exact baseline at all recorded channels in four bike/rider variants; hardtail dormant settings cannot change physics; both rider modes in full suspension, both buffer directions, accepted ultimate bounds and weak-buffer fallback; finest-pair peak force within 2%, matched shock travel within 0.2 mm, and residual below 1% of max(1 J, absolute support work, loss) on declared scenarios at 0.125/0.0625/0.03125 ms. Preserve strict record migration and validate all new fields. Full tests, real worker/headless parity, save/load, hardtail controls, responsive plots and inspected captures gate delivery. These qualify bounded numerical experiments, not the entire input rectangle or real-bike hardware.