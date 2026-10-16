# Iteration 8 evidence

Reviewed main 30b8165 (PR #7) and its successful deployment before implementation. The 97-test baseline passed locally without skips. [Review/scope](ITERATION_8_REVIEW.md) fixes the receiving gates; [model contract](FORK_BUFFERS.md) records the force/energy equations and limitations.

## Received feature

Optional fork top/bottom buffers now act through the shared browser/headless model. The viewer offers two receiving presets, editable width/spring/damping, engagement readouts and fork highlighting, signed force and stored/lost energy histories. Ultimate boundaries are unchanged; weak buffers can still terminate. Model v0.3 explicitly migrates complete v0.1/v0.2 records to no-buffer behaviour. No shock/rider buffer or physical damage claim is made.

The top-out preset uses the same forcing as its unbuffered control: the control terminates, while buffered motion completes. The softer-fork bottom preset loads both ends and completes; its unbuffered control can also complete, so mere completion is not offered as proof of buffer action. The separate weak/narrow buffer case reaches the ultimate domain and retains the final valid endpoint.

## Evidence and review

- Full local suite: 106 tests, no skips, Windows Node 24.19.0. New tests verify the independent potential gradient/passive power identity, sign symmetry and inactive region; native single-coordinate impact momentum, conservative turning depth and dissipation at 3/15 kg; all four coupled variants across three steps; bottom engagement, weak-buffer termination, recording cadence and schema migration.
- [No-buffer baseline](evidence/iteration-8-baseline.json): all existing recorded channels are exactly unchanged at all 801 points for hardtail/full suspension and fixed/passive rider in the same runtime.
- [Receiving matrix](evidence/iteration-8-buffers.json): 15 runs at 0.125/0.0625/0.03125 ms. Finest-pair top-force differences are 0.215–0.223%; bottom-force difference 0.0246%. Maximum matched fork-travel difference is 0.1592 mm; all remain below the declared 2%/0.2 mm limits. Energy residual is below 1% of work/loss scale in every run. This qualifies the bounded scenarios, not arbitrary parameter combinations or micrometre precision.
- Full real-browser suite passed under the Pages-style path with actual workers. The buffer export matches headless channels within 1e-8; top/bottom activation, identical-input unbuffered control, weak-buffer termination, complete setup reload and mobile/lifecycle plots pass. [Browser receipt](evidence/iteration-8-browser.json) records the measured difference and browser version.
- Inspected top-out and bottom-out desktop captures plus the 320 px mobile capture. Engagement text, signed force, fork highlight, synchronized plots and wrapping controls were visible. These are headless captures, not physical calibration, native display/input or participant evidence.

Reviewed force address/ownership, no duplicate frame action or external work, native versus custom energy, held explicit damper coupling, initialized buffer state, domain rollback, record migration, static-asset loading and browser control state. The custom force is not implicitly integrated merely because the native solver uses implicitfast. Source-backed research and explicit refinement remain separate from physical evidence. Solver perfection stays parked.

Exact-head hosted Windows/Linux and Chromium checks gate merge; their links and deployment receipt are recorded in the PR. Reproduce numerical evidence with `node scripts/buffer-evidence.mjs` and browser evidence with `node scripts/browser-check.mjs`.

## Follow-up coordination

The user's spatial deformable-tyre/contact and request-first terrain/cache/layer design is being captured incrementally in separate draft PR #8, using GPT-6.1 Sol and an isolated worktree. It is not mixed into this dynamics implementation or labelled as working terrain physics. Rear-shock buffers through changing linkage leverage remain the next local stop mechanism; actual attachment loads, soil/tyre contact, traction and damage have distinct gates.
