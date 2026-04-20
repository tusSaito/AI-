// LLM 統一インターフェース

import { loadProviderConfig } from './shared.js';
import { callProvider } from './providers.js';

let pipeline = null;
let loadingPromise = null;
let _status = 'idle';
let _statusMsg = '';
const listeners = new Set();

export function onStatusChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setStatus(s, msg = '') {
  _status = s; _statusMsg = msg;
  for (const fn of listeners) fn(s, msg);
}

const MODEL_PRIMARY = 'onnx-community/gemma-3-4b-it-ONNX';
const MODEL_FALLBACK = 'onnx-community/gemma-3-2b-it-ONNX';

async function loadLocalModel() {
  if (pipeline) return;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    setStatus('loading', 'モデルを読み込んでいます（数GB、初回は数分かかります）…');
    try {
      const { pipeline: createPipeline } = await import(
        'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3'
      );
      try {
        pipeline = await createPipeline('text-generation', MODEL_PRIMARY, {
          device: 'webgpu', dtype: 'q4f16'
        });
        setStatus('ready', '準備完了');
      } catch (e1) {
        console.warn('Primary model failed, trying fallback:', e1);
        pipeline = await createPipeline('text-generation', MODEL_FALLBACK, {
          device: 'webgpu', dtype: 'q4f16'
        });
        setStatus('ready', '準備完了（軽量モデル）');
      }
    } catch (e) {
      loadingPromise = null;
      setStatus('error', 'ローカルモデルの読み込みに失敗。API モードに切り替えてください。');
      throw e;
    }
  })();
  return loadingPromise;
}

async function generateLocal({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  if (!pipeline) throw new Error('ローカルモデルが読み込まれていません。API モードに切り替えてください。');
  const messages = [
    { role: 'system', content: system },
    { role: 'user',   content: user }
  ];
  const out = await pipeline(messages, {
    max_new_tokens: maxNewTokens,
    temperature, top_p: 0.95, do_sample: true
  });
  const generated = out[0].generated_text;
  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];
    return (last.content || '').trim();
  }
  return typeof generated === 'string' ? generated.trim() : '';
}

// ── 統一 generate ──
export async function generate({ system, user, maxNewTokens = 512, temperature = 0.7 }) {
  const cfg = loadProviderConfig();
  if (cfg.provider === 'local') {
    return generateLocal({ system, user, maxNewTokens, temperature });
  }
  // API モード: キーの存在を再確認
  const provCfg = cfg[cfg.provider];
  if (!provCfg?.apiKey) {
    throw new Error(`${cfg.provider.toUpperCase()} の API キーが設定されていません。サイドバーで入力してください。`);
  }
  return callProvider(cfg.provider, { system, user, maxNewTokens, temperature });
}

// ── 初期化 ──
export async function initLLM() {
  const cfg = loadProviderConfig();
  if (cfg.provider === 'local') {
    return loadLocalModel();
  }
  // API モード: キーがあれば即 ready
  const provCfg = cfg[cfg.provider];
  if (provCfg?.apiKey) {
    setStatus('ready', `${cfg.provider.toUpperCase()} API 接続準備完了`);
  } else {
    setStatus('ready', `${cfg.provider.toUpperCase()} API — キーを入力してください`);
  }
}

export function resetLLM() {
  pipeline = null;
  loadingPromise = null;
  setStatus('idle', '');
}
