# Decision 001: the first laboratory station

2026-10-14. Scope: Slice 1, not the final riding engine.

Use buildless HTML/CSS/Canvas and JavaScript ES modules, with Node.js for a loopback static server, scenario runner and independent tests. No third-party runtime dependencies. Node v24.19.0 is installed on the development host.

Alternatives considered: a native C++ graphics application gives a direct path to native libraries but adds windowing/plotting/build setup before this one-coordinate experiment; a game-engine scene offers integrated 3D tools but requires a separate decision about contact/solver semantics. Neither is rejected for the full bicycle. Reassess constrained multibody/3D technology before Slice 3/6 rather than expanding this ODE integrator into a general engine.

The browser and headless runner import exactly the same physics module. A run is calculated in a cancellable browser worker with a fixed step, then its recorded samples are played back independently of rendering. UI controls create a fresh run. This makes single-step and replay inspectable and avoids render timing changing physics.

Primary documentation checked:
- [MDN modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules): serve modules over HTTP; do not open the HTML through file://.
- [MDN requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame): display scheduling, not the physics clock.
- [Node test runner](https://nodejs.org/api/test.html): built-in test execution.
- [MathWorks spring and damper](https://www.mathworks.com/help/sm/ref/springanddamperforce.html): “relative velocity of the follower frame origin with respect to the base frame”.
- [NIST RK4 formula](https://www.ctcms.nist.gov/~langer/oof2man/RegisteredClass-RK4.html): four derivative stages with 1/6, 1/3, 1/3, 1/6 weights.

## Mapping to the station

Upward z is positive. Platen height is y(t), wheel centre is z, unloaded radius R.
Compression d = max(0, y + R - z); compression velocity q = y' - z'.
While geometric compression is positive, N = max(0, k d + c q); otherwise N = 0.
The wheel equation is z'' = N/m - g. This is a clipped linear spring/damper SURROGATE, not a calibrated tyre.

The source describes a bilateral spring/damper. Unilateral clipping is our explicit model choice; it prevents tensile normal force. Its release behaviour must not be mistaken for a measured carcass model.

Elastic energy U = k d²/2; kinetic K = m v²/2; gravitational V = m g z.
Support work rate W' = N y'. Effective loss D' = (N-kd)q in geometric contact, zero otherwise.
When unclipped this is c q². During clipped unloading it is -kd q, also nonnegative.
Thus K+V+U+D-W should remain at its initial value, subject to integration error. Report this effective loss honestly; it includes force-clipping loss, not only viscous damping.

RK4 advances [z, v, W, D, normal impulse, time without positive load] together. All derivative arrays are allocated once per solver. Contact transitions are detected at integration endpoints independently of graph recording, not root-located: event-time resolution is one solver step and formal smooth RK4 order does not apply across transitions. Sub-step transitions can still be missed.

Default step 0.5 ms; tests compare 0.5, 0.25 and 0.125 ms. Recording is at 200 Hz. Replay single-step means one recorded sample (default 5 ms), clearly distinguished from integration. Duration, integration step, recording interval and initial lift are configurable in the UI and preserved when loading/editing a setup.

Initial centre is R-mg/k at rest, unless a bounded initial lift is specified. Sinusoidal forcing starts at zero position with nonzero platen velocity, so its transient is intentional. Analytical harmonic tests exclude settling. A single bump starts at 1 s and uses A sin^4(pi f (t-1)) over one duration 1/f; both endpoint velocity and acceleration vanish.

Inputs are bounded for this numerical prototype. Compression over 35% of radius invalidates the run; this is a surrogate domain guard, not a tyre failure prediction. All example parameters are illustrative.
