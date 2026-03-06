#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

fail() {
  echo "[ERROR] $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少指令: $1"
}

if [[ "${EUID}" -eq 0 ]]; then
  fail "請不要用 root 直接執行。請用一般使用者（例如 ubuntu）執行此腳本。"
fi

if ! command -v sudo >/dev/null 2>&1; then
  fail "此腳本需要 sudo 權限"
fi

APP_DIR="${APP_DIR:-/opt/fp_stock}"
REPO_URL="${REPO_URL:-}"
BRANCH="${BRANCH:-main}"
PROJECT_USER="${PROJECT_USER:-$USER}"
SKIP_BUILD="${SKIP_BUILD:-false}"

if [[ -z "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  fail "首次部署必須提供 REPO_URL。範例：REPO_URL=https://github.com/<owner>/<repo>.git bash scripts/ec2_one_click_deploy.sh"
fi

log "開始 EC2 一鍵部署"
log "APP_DIR=${APP_DIR}"
log "BRANCH=${BRANCH}"

log "安裝系統套件與 Docker"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates docker.io docker-compose-plugin

log "啟用 Docker 服務"
sudo systemctl enable docker
sudo systemctl start docker

if ! groups "$PROJECT_USER" | grep -q '\bdocker\b'; then
  log "將使用者 ${PROJECT_USER} 加入 docker 群組"
  sudo usermod -aG docker "$PROJECT_USER"
fi

log "準備專案目錄"
sudo mkdir -p "${APP_DIR}"
sudo chown -R "$PROJECT_USER":"$PROJECT_USER" "${APP_DIR}"

if [[ -d "${APP_DIR}/.git" ]]; then
  log "偵測到既有 repo，進行更新"
  git -C "${APP_DIR}" fetch --all --prune
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  log "clone repo 到 ${APP_DIR}"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [[ ! -f ".env" ]]; then
  if [[ -f ".env.example" ]]; then
    log "建立 .env（由 .env.example 複製）"
    cp .env.example .env
  else
    log "找不到 .env.example，建立空白 .env"
    touch .env
  fi
fi

log "停止舊容器（若存在）"
sudo docker compose down || true

if [[ "${SKIP_BUILD}" == "true" ]]; then
  log "啟動容器（略過 build）"
  sudo docker compose up -d
else
  log "建置並啟動容器"
  sudo docker compose up --build -d
fi

log "容器狀態"
sudo docker compose ps

log "部署完成"
log "前端: http://<EC2_PUBLIC_IP>:5173"
log "後端: http://<EC2_PUBLIC_IP>:8080"
log "若你剛被加入 docker 群組，重新登入後才可不使用 sudo 執行 docker 指令"
