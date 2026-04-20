// 感情モデル — Ry 回転行列による 3 軸感情状態
// ※ 量子力学に着想を得た数学モデルであり、実際の量子計算ではない
export const AXES = ['confidence', 'curiosity', 'calm'];
const MAX_ROTATION = Math.PI / 6;

/** 初期状態: 各軸 P=0.5 */
export function createInitialState() {
  const s = 1 / Math.sqrt(2);
  return { confidence: [s, s], curiosity: [s, s], calm: [s, s] };
}

/** Ry(θ) 回転ゲートで状態ベクトルを更新 */
export function updateState(stateVec, impacts) {
  const next = {};
  for (const axis of AXES) {
    const impact = Math.max(-1, Math.min(1, impacts[axis] || 0));
    const theta = -impact * MAX_ROTATION;
    const cosH = Math.cos(theta / 2);
    const sinH = Math.sin(theta / 2);
    const [a, b] = stateVec[axis];
    let newA = cosH * a - sinH * b;
    let newB = sinH * a + cosH * b;
    const norm = Math.sqrt(newA * newA + newB * newB);
    next[axis] = [newA / norm, newB / norm];
  }
  return next;
}

/** 各軸の観測確率 P(positive) = |α|² */
export function probabilities(stateVec) {
  const p = {};
  for (const axis of AXES) p[axis] = stateVec[axis][0] ** 2;
  return p;
}

/** stateVec が有効な構造かチェックし、不正なら初期状態を返す */
export function validateOrReset(stateVec) {
  if (!stateVec || typeof stateVec !== 'object') return createInitialState();
  for (const axis of AXES) {
    const v = stateVec[axis];
    if (!Array.isArray(v) || v.length !== 2 ||
        typeof v[0] !== 'number' || typeof v[1] !== 'number' ||
        !isFinite(v[0]) || !isFinite(v[1])) {
      return createInitialState();
    }
  }
  return stateVec;
}
