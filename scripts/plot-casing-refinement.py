"""Optional Matplotlib consumer for the contact-free loss-decomposition study."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", default="artifacts/casing-refinement")
    directory = Path(parser.parse_args().directory)
    report = json.loads((directory / "report.json").read_text())
    assert report["model"] == "bikelab-contact-free-loss-refinement-0.1"
    cases = report["cases"]
    plt.rcParams.update({"font.size": 10, "svg.fonttype": "none", "svg.hashsalt": "bikelab-casing-refinement-v1"})
    fig, axes = plt.subplots(1, 3, figsize=(16, 5), layout="constrained")
    fig.suptitle("High-viscosity casing: trajectory error and loss quadrature both matter", fontsize=15)

    for c in cases:
        points = json.loads((directory / c["file"]).read_text())["frames"]
        points = [p for p in points if p["time"] <= .00025]
        axes[0].plot([p["time"] * 1e6 for p in points],
                     [100 * p["velocityError"] / report["scales"]["velocity"] for p in points],
                     ".-", markersize=3, label=f'{c["dt"] * 1e6:g} µs')
    axes[0].set(title="Initial damping transient", xlabel="Time (µs)", ylabel="Maximum velocity difference / 0.01 m/s (%)")
    axes[0].legend(title="Euler timestep", fontsize=8, title_fontsize=9)

    step = [c["dt"] * 1e6 for c in cases]
    axes[1].loglog(step, [100 * c["maxVelocityError"] / report["scales"]["velocity"] for c in cases], "o-", label="Velocity / initial velocity scale")
    axes[1].loglog(step, [100 * c["maxPositionError"] / report["scales"]["position"] for c in cases], "s-", label="Position / energy-derived scale")
    axes[1].loglog(step, [100 * c["maxima"]["residual"] / report["initialEnergy"] for c in cases], "^-", label="Energy + loss residual / initial energy")
    axes[1].set(title="Refinement; no production promotion", xlabel="Euler timestep (µs)", ylabel="Maximum sampled discrepancy (%)")
    axes[1].legend(fontsize=8)

    selected = [cases[0], cases[1], cases[-1]]
    terms = [("energyDifference", "Energy difference"),
             ("sampledPowerDifference", "Sampled-power difference"),
             ("referenceQuadrature", "Reference quadrature")]
    for i, (key, label) in enumerate(terms):
        axes[2].bar([j + (i-1)*.22 for j in range(3)],
                    [100 * c["atPeakResidual"][key] / report["initialEnergy"] for c in selected],
                    width=.22, label=label)
    axes[2].plot(range(3), [100 * c["atPeakResidual"]["residual"] / report["initialEnergy"] for c in selected],
                 "kD", label="Signed total")
    axes[2].axhline(0, color="black", linewidth=.6)
    axes[2].set_xticks(range(3), [f'{c["dt"] * 1e6:g}' for c in selected])
    axes[2].set(title="Terms at each case's peak residual", xlabel="Euler timestep (µs)", ylabel="Signed contribution / initial energy (%)")
    axes[2].legend(fontsize=8, loc="upper right")
    for axis in axes:
        axis.grid(alpha=.2)
        axis.set_axisbelow(True)
    svg = directory / "diagnostic.svg"
    fig.savefig(svg, metadata={"Date": None})
    svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")
    fig.savefig(directory / "diagnostic.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
