// 量子感情モデル — Ry 回転ゲートによる 3 軸感情状態
export const AXES = ['confidence', 'curiosity', 'calm'];
const MAX_ROTATION = Math.PI / 6;

const LABELS = {
  confidence: { pos: '自信', neg: '不安' },
  curiosity:  { pos: '好奇心', neg: '倦怠' },
  calm:       { pos: '冷静', neg: '焦燥' }
};

/** 初期状態: 各軸 P=0.5 の均等重ね合わせ */
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

/** 確率値を人間可読な記述に変換 */
export function describeEmotion(probs) {
  return AXES.map(axis => {
    const p = probs[axis];
    const l = LABELS[axis];
    if (p >= 0.7) return `${l.pos}が強い`;
    if (p <= 0.3) return `${l.neg}が強い`;
    return `${l.pos}と${l.neg}の間`;
  }).join('、');
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
