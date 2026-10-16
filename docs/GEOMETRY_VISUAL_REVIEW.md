# Bicycle geometry visual review

2026-10-16. User-requested review against actual bicycle imagery, completed after retrieving the source JPEGs through hosted run [38879501878](https://github.com/CraigHutchinson/BikeLab/actions/runs/38879501878). The local network download was cancelled; it was not counted as inspection. Actual source images and the final rendered screenshots were subsequently opened and inspected.

## Sources inspected

- [Orange Five Factory 2020, manufacturer photograph and geometry](https://orangebikes.com/blogs/bike-archive-2020/five-factory-2020): side-on single-pivot reference. Its published geometry specifies 25 mm BB drop, 65° head angle, 433 mm chainstay and a 210 × 55 mm shock; dimensions are unsagged, and quoted BB ground height uses a 708 mm tyre diameter.
- [Orange Crush Comp 2023, retailer photograph](https://www.tredz.co.uk/.Orange-Crush-Comp-27-5-Mountain-Bike-2023-Hardtail-MTB_250279.htm): qualitative hardtail topology reference. The lower stay joins the BB region to the rear axle; the upper stay joins the seat-tube region. No rear suspension pivot is implied.

Images are review references, not bundled application artwork or calibrated digitized geometry. The downloaded original files and hashes are retained in CI artifact `12036039968`; archive SHA-256 `8496baa23b774b05960b6e62445d9f1398bc64172e6b6b3670b26102ccc64af3`. Individual file identities are in [the source receipt](evidence/geometry-reference-sources.json).

## Corrections made and verified

The previous drawing's anonymous BB point was at frame-local (-0.12,-0.15) m: 140 mm **above** the unloaded axle line and 500 mm above ground at the reference pose. That was an incorrect conventional mountain-bike frame illustration, not a reasonable BB placement. Its hardtail lower stay also ran to the schematic suspension pivot instead of the BB.

The shared `bike-geometry.js` display landmarks now put the BB at local (0,-0.315) m: **25 mm below** the unloaded axle line and **335 mm above ground** with the fixture's 720 mm tyres. The illustrative rear-centre distance is 450.694 mm. This uses the manufacturer's drop as a proportion reference, not a claim that BikeLab reproduces the Five's full geometry. Actual sag, pitch and platen motion change world-space BB height and axle relationships during replay.

The hardtail's rigid stays now connect rear axle–BB and rear axle–seat tube. Full suspension retains its actual single rotating arm and separate main pivot. A finite head tube distinguishes the two front-frame attachment points, and the fork stays collinear with its actual slide axis. The BB is marked explicitly, distinct from the rider COM and suspension pivot. Shock eyes and main pivot are drawn from the physical model; the arm eye rotates with the swingarm and the frame eye stays on the frame.

Tests independently compare drawn front/rear axle and shock-eye coordinates against native MuJoCo world coordinates at three nonzero fork/pitch/arm poses in both variants. They also check the unloaded BB datum, rear-centre length and head-tube length. Desktop full-suspension and hardtail/mobile captures are inspected alongside the source photographs. The first hosted drawing check exposed a missing preview-server asset route; it was fixed before the successful run, and an explicit serving regression is retained.

## What the comparison does not confirm

The bottom bracket and hardtail topology are corrected. The drawn suspension now agrees with its simulated geometry; **the physical linkage is still synthetic, not a validated real-bike geometry**. The Orange photograph shows a considerably shorter, more horizontal shock arrangement. BikeLab's current unloaded spring attachment distance is 351.141 mm, with a main pivot 165 mm above its displayed BB. Neither number is an inferred manufacturer dimension. Its zero-offset fork also differs from the reference bicycle.

Moving a displayed shock eye to resemble the photo while leaving the solver unchanged would create another error. Moving the physical eye changes leverage, spring force, equilibrium and travel, so a production-bike geometry preset needs sourced pivot/eye coordinates, spring dimensions and a fresh static/virtual-work/travel/refinement matrix. Photography alone does not provide those calibrated coordinates. This is an explicit follow-up, not a completed geometry-calibration claim. No braking, drivetrain or rider attachment force is applied at the decorative BB yet.
