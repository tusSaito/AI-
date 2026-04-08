# Penguin Dyle（ペンギン大流）

ブラウザ完結型 AI コーチング日記アプリ。

AI キャラクター「ペンギン大流（ダイル）」と会話しながら日々を振り返り、量子力学に着想を得た感情モデルで気持ちの推移を記録・可視化します。

## 特徴

- **完全クライアントサイド** — サーバ不要。推論・保存すべてブラウザ内で完結
- **マルチプロバイダ対応** — ローカル推論（WebGPU）/ Gemini API / OpenAI API / Claude API を切替可能
- **量子感情モデル** — 3 軸（自信・好奇心・冷静）を量子ビットの Ry 回転ゲートで連続的に更新
- **古典感情分析** — Valence（快↔不快）と Arousal（活性↔沈静）の 2 軸
- **プライバシー重視** — 日記データは localStorage にのみ保存。API キーもブラウザ内のみ
- **長期記憶** — 会話からユーザーの特徴を抽出し、以降の対話に活用
- **カスタマイズ可能** — `js/persona.js` の 2 定数を書き換えるだけでキャラ差し替え

## はじめかた

### GitHub Pages で使う（推奨）

GitHub Pages で公開済みの場合、以下の URL にアクセスするだけで使えます。

```
https://<username>.github.io/<repo-name>/
```

サーバのセットアップは不要です。Chrome 113+ または Edge 113+ を使用してください。

### ローカルで開発する場合

ES Modules を使用するため、ローカルでは HTTP サーバが必要です。

```bash
# macOS: start.command をダブルクリック、または:
python3 -m http.server 8765
# → http://localhost:8765 でアクセス
```

### 推論モードを選択

| モード | 必要なもの | 特徴 |
|--------|-----------|------|
| **ローカル（デフォルト）** | WebGPU 対応ブラウザ、16GB+ RAM | 完全オフライン、初回 3〜4GB ダウンロード |
| **Gemini API** | API キー | 無料枠あり、日本語に強い |
| **OpenAI API** | API キー | 汎用的、OpenAI 互換サーバにも対応 |
| **Claude API** | API キー | 高品質な日本語文章生成 |

API キーはサイドバーの「推論モード」セクションで入力します。キーはブラウザの localStorage にのみ保存され、サーバには送信されません。

## ページ構成

| ページ | 説明 |
|--------|------|
| **会話**（index.html） | ダイルとチャット。日記生成のトリガー |
| **日記**（diary.html） | 生成された日記の表示・保存・一覧 |
| **記録**（archive.html） | カレンダー、感情グラフ、検索、エクスポート/インポート |

## ファイル構成

```
├── index.html          # 会話ページ
├── diary.html          # 日記ページ
├── archive.html        # 記録ページ
├── dark.css            # ダークモード用スタイル
├── start.command       # macOS 起動スクリプト
├── docs/
│   └── REQUIREMENTS.md # 要件定義書
├── img/
│   └── dyle.png        # ダイルのアバター画像
└── js/
    ├── main.js         # 会話ページ UI
    ├── diary-page.js   # 日記ページ UI
    ├── archive-page.js # 記録ページ UI
    ├── llm.js          # LLM 統一インターフェース
    ├── providers.js    # API プロバイダ (Gemini/OpenAI/Claude)
    ├── pipeline.js     # 日記生成パイプライン
    ├── dialogue.js     # 対話応答生成
    ├── sentiment.js    # 感情分析 (古典+量子)
    ├── quantum.js      # 量子感情モデル
    ├── persona.js      # キャラクター設定
    ├── memory.js       # 長期記憶
    └── shared.js       # 共通ユーティリティ
```

## データの保存

すべてのデータはブラウザの localStorage に保存されます。サーバへのデータ送信はありません（API モード時のプロンプト送信を除く）。

- **エクスポート**: 記録ページから JSON ファイルとしてダウンロード
- **インポート**: JSON ファイルを読み込み（5MB 上限）
- **全削除**: 記録ページから全データを消去

## プライバシーに関する注記

- **ローカルモード**: データは一切外部に送信されません
- **API モード**: プロンプトと会話テキストのみが選択した API プロバイダに送信されます。日記データや感情パラメータは送信されません
- **API キー**: ブラウザの localStorage にのみ保存されます。リポジトリに含まれることはありません

## キャラクターのカスタマイズ

`js/persona.js` の以下 2 定数を書き換えることで、キャラクターを差し替えられます:

```javascript
export const PERSONA_NAME = 'ダイル';
export const SYSTEM_PROMPT = `あなたは…`;
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| LLM（ローカル） | Transformers.js v3 + WebGPU |
| LLM（API） | Gemini / OpenAI / Claude REST API |
| UI | Tailwind CSS (CDN) + FontAwesome 6 |
| JavaScript | Vanilla ES6 Modules |
| ストレージ | localStorage + IndexedDB |

## GitHub Pages での公開方法

静的ファイルのみで構成されているため、GitHub Pages でそのまま公開できます。

1. リポジトリの **Settings → Pages** を開く
2. Source を `main` ブランチの `/` (root) に設定
3. 数分後に `https://<username>.github.io/<repo-name>/` でアクセス可能に

ローカルサーバは不要です。

## ライセンス

MIT License
