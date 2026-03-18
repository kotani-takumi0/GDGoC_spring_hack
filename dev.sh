#!/bin/bash

# =============================================================================
# Riasapo-dev 一括起動スクリプト (ログ表示版)
# =============================================================================

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# 終了時にバックグラウンドプロセスを殺す
trap 'kill $BACKEND_PID; exit' SIGINT SIGTERM

echo "🚀 Riasapo-dev を起動します..."

# 1. バックエンド (Python/uv) の起動
echo "📡 [1/2] バックエンド (FastAPI) を起動中 (port: 8000)..."
cd "$BACKEND_DIR"

# APIキーのチェック
if [ -z "$GEMINI_API_KEY" ] && [ ! -f .env ]; then
  echo "⚠️  警告: GEMINI_API_KEY が見当たりません。"
fi

# ログを表示するように変更 ( & を末尾につけてバックグラウンド実行 )
uv run uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 2. フロントエンド (Next.js) の起動
echo "💻 [2/2] フロントエンド (Next.js) を起動中 (port: 3000)..."
cd "$FRONTEND_DIR"

# サーバーが立ち上がるまで 3 秒待機
sleep 3
npm run dev
