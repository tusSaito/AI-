from __future__ import annotations

import numpy as np

AXES = ("confidence", "curiosity", "calm")

AXIS_LABELS = {
    "confidence": ("自信", "不安"),
    "curiosity": ("好奇心", "倦怠"),
    "calm": ("冷静", "焦燥"),
}

MAX_ROTATION = np.pi / 6


class QuantumEmotionState:
    def __init__(self, state_dict: dict | None = None) -> None:
        if state_dict is None:
            s = 1.0 / np.sqrt(2)
            self.states = {axis: np.array([s, s]) for axis in AXES}
        else:
            self.states = {
                axis: np.array(state_dict[axis], dtype=float) for axis in AXES
            }

    @staticmethod
    def _ry_gate(theta: float) -> np.ndarray:
        c = np.cos(theta / 2)
        s = np.sin(theta / 2)
        return np.array([[c, -s], [s, c]])

    def update(self, impacts: dict[str, float]) -> None:
        for axis, impact in impacts.items():
            if axis not in self.states:
                continue
            impact = float(np.clip(impact, -1.0, 1.0))
            theta = -impact * MAX_ROTATION
            gate = self._ry_gate(theta)
            self.states[axis] = gate @ self.states[axis]
            norm = float(np.linalg.norm(self.states[axis]))
            if norm > 0:
                self.states[axis] /= norm

    def probabilities(self) -> dict[str, float]:
        return {
            axis: float(np.abs(self.states[axis][0]) ** 2) for axis in AXES
        }

    def to_dict(self) -> dict[str, list[float]]:
        return {axis: self.states[axis].tolist() for axis in AXES}

    def describe(self) -> str:
        probs = self.probabilities()
        lines = ["## 現在の感情状態"]
        for axis, p in probs.items():
            pos, neg = AXIS_LABELS[axis]
            if p >= 0.7:
                desc = f"{pos}が強い（{p:.0%}）"
            elif p >= 0.5:
                desc = f"やや{pos}寄り（{p:.0%}）"
            elif p >= 0.3:
                desc = f"やや{neg}寄り（{p:.0%}）"
            else:
                desc = f"{neg}が強い（{p:.0%}）"
            lines.append(f"- {pos}↔{neg}: {desc}")
        return "\n".join(lines)
