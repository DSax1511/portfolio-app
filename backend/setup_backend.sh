#!/usr/bin/env bash
set -e

echo "👉 Moving to script directory..."
cd "$(dirname "$0")"

echo "👉 Checking for python3..."
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ Python 3 is not installed."
  echo "   Install it with:  brew install python"
  exit 1
fi

echo "👉 Creating virtual environment (.venv) if needed..."
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "✅ Virtual environment created."
else
  echo "✅ Virtual environment already exists."
fi

echo "👉 Activating virtual environment..."
# This activation is only for this script's process
source .venv/bin/activate

echo "👉 Upgrading pip..."
pip install --upgrade pip

if [ -f "requirements.txt" ]; then
  echo "👉 Installing requirements from requirements.txt..."
  pip install -r requirements.txt
else
  echo "⚠️ No requirements.txt found in backend directory."
fi

echo "👉 Trying to start FastAPI with uvicorn..."

if command -v uvicorn >/dev/null 2>&1; then
  if [ -f "main.py" ]; then
    echo "🚀 Starting server: uvicorn main:app --reload --port 8000"
    uvicorn main:app --reload --port 8000
  elif [ -f "app/main.py" ]; then
    echo "🚀 Starting server: uvicorn app.main:app --reload --port 8000"
    uvicorn app.main:app --reload --port 8000
  else
    echo "⚠️ Could not find main.py or app/main.py."
    echo "   You'll need to run uvicorn manually once you know the app module."
  fi
else
  echo "❌ uvicorn is not installed."
  echo "   Install it inside the venv with: pip install uvicorn[standard]"
fi

