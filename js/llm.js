// LLM 統一インターフェース — ローカル (Transformers.js WebGPU) / API を透過切替

import { loadProviderConfig } from './shared.js';
import { callProvider } from './providers.js';

let pipeline = null;
let processor = null;
let loadingPromise = null;
let _status = 'idle';       // idle | loading | ready | error
let _statusMsg = '';
const listeners = new Set();

// ── ステータス通知 ──
export function onStatusChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setStatus(s, msg = '') {
  _status = s; _statusMsg = msg;
  for (const fn of listeners) fn(s, msg);
}
export function getStatus() { return { status: _status, message: _statusMsg }; }

// ── ローカルモデル初期化 ──
const MODEL_PRIMARY = 'onnx-community/gemma-3-4b-it-ONNX';
const MODEL_FALLBACK = 'onnx-community/gemma-3-2b-it-ONNX';

async function loadLocalModel() {
  if (pipeline) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    setStatus('loading', 'モデルを読み込んでいます…');
    const { pipeline: createPipeline } = await import(
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3'
    );

    try {
      pipeline = await createPipeline('text-generation', MODEL_PRIMARY, {
        device: 'webgpu',
        dtype: 'q4f16'
      });
      setStatus('ready', '準備完了');
    } catch (e1) {
      console.warn('Primary model failed, trying fallback:', e1);
      try {
        pipeline = await createPipeline('text-generation', MODEL_FALLBACK, {
          device: 'webgpu',
          dtype: 'q4f16'
        });
        setStatus('ready', '準備完了（軽量モデル）');
      } catch (e2) {
        setStatus('error', 'モデルの読み込みに失敗しました');
        throw e2;
      }
    }
  })();
  return loadingPromise;
}

async function generateLocal({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  await loadLocalModel();
  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: user }
  ];
  const out = await pipeline(messages, {
    max_new_tokens: maxNewTokens,
    temperature,
    top_p: 0.95,
    do_sample: true
  });
  const generated = out[0].generated_text;
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    return (last.content || '').trim();
  }
  const fullText = typeof generated === 'string' ? generated : '';
  const marker = user.slice(-40);
  const idx = fullText.lastIndexOf(marker);
  return idx >= 0 ? fullText.slice(idx + marker.length).trim() : fullText.trim();
}

// ── 統一 generate ──
export async function generate({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  const cfg = loadProviderConfig();
  if (cfg.provider === 'local') {
    return generateLocal({ system, user, maxNewTokens, temperature });
  }
  return callProvider(cfg.provider, { system, user, maxNewTokens, temperature });
}

// ── 初期化（UI から呼ぶ）──
export async function initLLM() {
  const cfg = loadProviderConfig();
  if (cfg.provider === 'local') {
    return loadLocalModel();
  }
  setStatus('ready', `${cfg.provider.toUpperCase()} API で接続`);
}

// ── 状態リセット（プロバイダ切替時）──
export function resetLLM() {
  pipeline = null;
  loadingPromise = null;
  setStatus('idle', '');
}
