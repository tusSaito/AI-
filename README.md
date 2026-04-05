# Superposition — 量子感情モデル搭載 AI日記エージェント（Webアプリ版）

ローカルの Gemma モデルと量子感情モデルを組み合わせた、自己啓発型 AI キャラクター日記生成 Web アプリ。

**🔒 プライバシー重視設計**: あなたの日記データはブラウザ内（localStorage）にのみ保存されます。サーバには一切残りません。

## フロー

1. ユーザーがブラウザで **日付 + 自分の日記** を入力・送信
2. （ブラウザ）前回の量子状態をリクエストに添付
3. （サーバ）ユーザー文を **感情分析**（ローカル Gemma）
4. （サーバ）**Ry 回転ゲート** で量子感情状態を更新
5. （サーバ）確定した感情状態でキャラクター「カイ」が**自分の日記**を生成
6. （ブラウザ）AI日記 + 感情バー表示 → 「保存」ボタンで localStorage に保存
7. JSONエクスポート/インポートで端末間バックアップ可能

## セットアップ

```bash
pip install -r requirements.txt

# 初回はモデルDLに時間がかかります
export GEMMA_MODEL_ID="google/gemma-4-E4B-it"  # 変更可
python app.py
```

### 利用可能な Gemma 4 モデル（2026年4月リリース）

| モデルID | サイズ | 用途 |
|---------|-------|------|
| `google/gemma-4-E2B-it` | 5B | 軽量・オンデバイス |
| `google/gemma-4-E4B-it` | 8B | **デフォルト（推奨）** |
| `google/gemma-4-26B-A4B-it` | 26B MoE (4B active) | 高品質 |
| `google/gemma-4-31B-it` | 31B Dense | 最高品質・要GPU |

ブラウザで http://127.0.0.1:5000 を開く。

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `GEMMA_MODEL_ID` | `google/gemma-4-E4B-it` | HF のモデルID |
| `HOST` | `127.0.0.1` | バインドホスト |
| `PORT` | `5000` | ポート |
| `FLASK_DEBUG` | `0` | `1` でデバッグモード |

## ディレクトリ構成

```
├── app.py                  # Flask サーバ（stateless）
├── requirements.txt
├── core/
│   ├── quantum_emotion.py  # 量子感情モデル（NumPy）
│   ├── llm.py              # Gemma ロード + 生成
│   ├── sentiment.py        # 感情影響度分析
│   ├── diary_writer.py     # AI日記生成
│   └── persona.py          # キャラクター設定
├── templates/index.html    # フロントエンド
└── static/{style.css, script.js}
```

## 量子感情モデル

3軸（`confidence`/`curiosity`/`calm`）を量子ビット `α|0⟩ + β|1⟩` として保持。

- 初期状態: 均等な重ね合わせ `(1/√2, 1/√2)` → P(positive)=50%
- 更新: 影響度 × Ry 回転ゲート（角度上限 ±π/6）で急変を防止
- 観測値: `P(positive) = |α|²`
- **連続性**: 状態ベクトルをブラウザ側で持ち、次回送信時にサーバへ渡す

## データの扱い

- **サーバに保存されるもの**: なし（リクエスト/レスポンス完結のステートレス設計）
- **ブラウザに保存されるもの**: `localStorage["quantum_diary_entries_v1"]`
  - 日付 / ユーザー日記 / AI日記 / 感情値 / 状態ベクトル
- **端末間移動**: JSONエクスポート → 別端末でインポート

## セキュリティ

- Flask を `127.0.0.1` バインド（外部非公開がデフォルト）
- CSP / X-Frame-Options / nosniff などセキュリティヘッダ付与
- ユーザー入力: 日付正規表現検証 + 4000文字制限 + JSONスキーマチェック
- リクエストサイズ 64KB 上限
- `transformers` は `trust_remote_code=False`
- XSS対策: フロントでは `textContent` のみ使用（`innerHTML` は固定テンプレート除き不使用）
- 状態ベクトルの型・長さバリデーション（サーバ側 `_parse_previous_state`）
- インポートファイル 5MB 上限

## ライセンス

MIT License
