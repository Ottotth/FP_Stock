#!/bin/bash
if type deactivate &> /dev/null; then
  echo "🔁 Deactivating enviroment..."
  deactivate
fi
if [ -d "_pyenv" ]; then
  echo "🔁 Removing old virtual environment (if any)..."
  rm -rf _pyenv
fi
echo "📦 Creating new virtual environment..."
PYTHON_BIN=""
if command -v python3 &> /dev/null; then
  PYTHON_BIN="python3"
elif command -v python &> /dev/null; then
  PYTHON_BIN="python"
else
  echo "❌ Python not found. Install Python 3 and ensure 'python3' is in PATH."
  exit 1
fi
"$PYTHON_BIN" -m venv _pyenv
VENV_PYTHON="_pyenv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "❌ Virtual environment creation failed."
  exit 1
fi
echo "✅ Activating virtual environment..."
source _pyenv/bin/activate
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r requirements.txt
"$VENV_PYTHON" -m ipykernel install --user --name=_pyenv --display-name "Python (_pyenv)"
# python --version
"$VENV_PYTHON" -m pip --version
"$VENV_PYTHON" --version
"$VENV_PYTHON" -m jupyter --version
echo "✅ Environment Setup complete."