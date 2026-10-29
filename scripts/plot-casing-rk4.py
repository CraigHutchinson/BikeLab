"""Optional Matplotlib consumer for the fixed-budget contact-free RK4 screen."""
import argparse
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", nargs="?", default="artifacts/casing-rk4")
    directory = Path(parser.parse_args().directory)
    report = json.loads((directory / "report.json").read_text())
    assert report["model"] == "bikelab-contact-free-rk4-screen-0.1"
    cases = report["cases"]
    assert all(c["status"] == "completed" for c in cases), "Inspect terminated cases before plotting a complete sweep"
    plt.rcParams.update({"font.size": 10, "svg.fonttype": "none", "svg.hashsalt": "bikelab-casing-rk4-v1"})
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), layout="constrained")
    passing = [f'{c["dt"] * 1e6:g}' for c in cases if c["screenPassed"]]
    outcome = ("passing timesteps: " + ", ".join(passing) + " µs") if passing else "no timestep passes the screen"
    fig.suptitle("Contact-free RK4: " + outcome, fontsize=14)
    labels = [("position", "Position difference"), ("velocity", "Velocity difference"),
              ("residual", "Energy + stage-loss residual"), ("loss", "Stage-loss difference")]
    markers = ["s-", "o-", "^-", "x--"]
    step = [c["dt"] * 1e6 for c in cases]
    for (key, label), marker in zip(labels, markers):
        axes[0].loglog(step, [100 * c["normalized"][key] for c in cases], marker, label=label)
    budgets = set(report["screenBudgets"].values())
    assert len(budgets) == 1
    budget = 100 * budgets.pop()
    axes[0].axhline(budget, color="black", linestyle=":", label=f"Fixed {budget:g}% budget (all four)")
    axes[0].set(title="Every-step maxima; failures retained", xlabel="Native RK4 timestep (µs)", ylabel="Error / fixed initial scale (%)")
    axes[0].legend(fontsize=8)

    for c in cases:
        points = json.loads((directory / c["file"]).read_text())["frames"]
        points = [p for p in points if p["time"] <= .00025]
        axes[1].plot([p["time"] * 1e6 for p in points],
                     [100 * p["velocity"] / report["scales"]["velocity"] for p in points],
                     ".-", markersize=3, label=f'{c["dt"] * 1e6:g} µs')
    axes[1].set(title="Initial transient cannot be judged from the final state", xlabel="Time (µs)", ylabel=f'Maximum velocity difference / {report["scales"]["velocity"]:g} m/s (%)')
    axes[1].legend(title="Native endpoint samples", fontsize=8, title_fontsize=9)
    for axis in axes:
        axis.grid(alpha=.2)
    svg = directory / "diagnostic.svg"
    fig.savefig(svg, metadata={"Date": None})
    svg.write_text("\n".join(line.rstrip() for line in svg.read_text().splitlines()) + "\n")
    fig.savefig(directory / "diagnostic.png", dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    main()
