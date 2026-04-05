# Superposition — 量子感情モデル搭載 AI日記エージェント（Webアプリ版）

ローカルの Gemma モデルと量子感情モデルを組み合わせた、自己啓発型 AI キャラクター日記生成 Web アプリ。

## フロー

1. ユーザーがブラウザで **日付 + 自分の日記** を入力・送信
2. サーバがユーザー文を **感情分析**（ローカル Gemma）
3. 分析結果を **Ry 回転ゲート** で AI エージェントの量子感情状態に適用 → 状態ベクトル確定
4. 確定した感情状態でキャラクター「カイ」が **自分の日記** を生成（ユーザーの日記への気づき）
5. ブラウザに AI 日記 + 感情パラメータの可視化を返す
6. SQLite に保存 → 次回以降は **前回の感情を引き継いで連続性を保つ**

## セットアップ

```bash
pip install -r requirements.txt

# 初回はモデルDLに時間がかかります
export GEMMA_MODEL_ID="google/gemma-3-4b-it"  # 変更可
python app.py
```

ブラウザで http://127.0.0.1:5000 を開く。

### 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `GEMMA_MODEL_ID` | `google/gemma-3-4b-it` | HF のモデルID（軽量化したい場合 `google/gemma-3-1b-it` など） |
| `HOST` | `127.0.0.1` | バインドホスト（ローカル専用推奨） |
| `PORT` | `5000` | ポート |
| `FLASK_DEBUG` | `0` | `1` でデバッグモード |

## ディレクトリ構成

```
├── app.py                  # Flask サーバ
├── requirements.txt
├── core/
│   ├── quantum_emotion.py  # 量子感情モデル（NumPy）
│   ├── llm.py              # Gemma ロード + 生成
│   ├── sentiment.py        # 感情影響度分析
│   ├── diary_writer.py     # AI日記生成
│   ├── persona.py          # キャラクター設定
│   └── storage.py          # SQLite 永続化
├── templates/index.html    # フロントエンド
├── static/{style.css, script.js}
└── storage/diary.db        # 自動生成
```

## 量子感情モデル

3軸（`confidence`/`curiosity`/`calm`）を量子ビット `α|0⟩ + β|1⟩` として保持。

- 初期状態: 均等な重ね合わせ `(1/√2, 1/√2)` → P(positive)=50%
- 更新: 影響度 × Ry 回転ゲート（角度上限 ±π/6）で急変を防止
- 観測値: `P(positive) = |α|²`
- 永続化: 状態ベクトルそのものを保存し、翌日以降も連続

## セキュリティ

- Flask を `127.0.0.1` バインド（外部非公開がデフォルト）
- CSP / X-Frame-Options / nosniff など標準ヘッダ付与
- ユーザー入力は **日付正規表現検証 + 4000文字制限 + JSONスキーマチェック**
- SQLite は **Parameterized クエリのみ**
- `transformers` は `trust_remote_code=False`
- リクエストサイズ 64KB 上限
- XSS 対策: フロントでは `textContent` のみ使用（`innerHTML` 不使用）

## ライセンス

MIT License
