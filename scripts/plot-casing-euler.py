"""Optional scientific consumer; requires Matplotlib, never used by the app."""
import argparse
import json
import math
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", default="artifacts/casing-euler")
    args = parser.parse_args()
    directory = Path(args.directory)
    report = json.loads((directory / "report.json").read_text())
    assert report["model"] == "bikelab-contact-free-euler-trial-0.1"
    cases = report["cases"]

    def select(kind, mode, nodes, viscosity=None):
        return sorted((c for c in cases if c["kind"] == kind and c["mode"] == mode
                       and c["nodes"] == nodes
                       and (viscosity is None or c["input"]["seed"]["wheel"]["edgeViscosity"] == viscosity)),
                      key=lambda c: c["admission"]["dt"])

    def frames(case):
        return json.loads((directory / case["file"]).read_text())["frames"]

    plt.rcParams.update({"font.size": 10, "svg.fonttype": "none", "svg.hashsalt": "bikelab-casing-euler-v1"})
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.7), layout="constrained")
    fig.suptitle("Contact-free Euler diagnostic — accuracy remains a separate gate", fontsize=15)

    uniform = select("ring", "x", 64, .5)[-1]
    points = frames(uniform)
    omega = math.sqrt(uniform["coefficients"]["foundationStiffness"] / uniform["coefficients"]["nodeMass"])
    time = [p["time"] for p in points]
    expected = [-.001 * omega * math.sin(omega * t) + .01 * math.cos(omega * t) for t in time]
    axes[0].plot([t * 1000 for t in time], expected, color="#555555", linewidth=2.5, label="Exact uniform oscillator")
    axes[0].plot([t * 1000 for t in time], [p["meanX"] for p in points], color="#167a9c", linestyle="--", label="Euler, 31.25 µs")
    axes[0].set(title="Uniform translation is retained", xlabel="Time (ms)", ylabel="Mean x velocity (m/s)")
    axes[0].legend(loc="lower left", fontsize=8)

    for label, group in [("64-node uniform x", select("ring", "x", 64, .5)),
                         ("Damped two-node pair", select("pair", "x", 2))]:
        axes[1].plot([c["admission"]["dt"] * 1e6 for c in group],
                     [c["summary"]["maxPositionError"] * 1e6 for c in group], "o-", label=label)
    axes[1].set(title="Position error refines", xlabel="Timestep (µs)", ylabel="Maximum position error (µm)")
    axes[1].legend(fontsize=8)

    high = select("ring", "alternating", 128, 3)
    for case in high:
        if case["status"] != "completed":
            assert case["status"] == "admission-rejected"
            continue
        points = frames(case)
        axes[2].plot([p["time"] * 1000 for p in points],
                     [100 * abs(p["residual"]) / case["summary"]["initialEnergy"] for p in points],
                     label=f'{case["admission"]["dt"] * 1e6:g} µs')
    axes[2].set(title="High viscosity: accuracy unresolved", xlabel="Time (ms)", ylabel="|Energy + loss − initial energy| / initial (%)")
    axes[2].legend(fontsize=8, title="128 nodes, alternating velocity", title_fontsize=8)
    axes[2].text(.04, .64, "31.25 µs rejected before stepping\n(rest-shape sufficient bound)",
                 transform=axes[2].transAxes, fontsize=8)
    for axis in axes:
        axis.grid(alpha=.2)
    fig.savefig(directory / "diagnostic.svg", metadata={"Date": None})
    svg = directory / "diagnostic.svg"
    svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")
    fig.savefig(directory / "diagnostic.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
