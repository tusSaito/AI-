#!/bin/bash
# macOS: ダブルクリックでローカルサーバを起動
cd "$(dirname "$0")"
echo "Penguin Dyle サーバを起動します…"
echo "ブラウザで http://localhost:8765 を開いてください"
echo "終了するには Ctrl+C を押してください"
python3 -m http.server 8765
