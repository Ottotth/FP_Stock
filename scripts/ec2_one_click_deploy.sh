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
DB_MIGRATION_MODE="${DB_MIGRATION_MODE:-none}"
S3_DUMP_URI="${S3_DUMP_URI:-}"
AWS_REGION="${AWS_REGION:-}"
RDS_HOST="${RDS_HOST:-}"
RDS_PORT="${RDS_PORT:-5432}"
RDS_DB="${RDS_DB:-}"
RDS_USER="${RDS_USER:-}"
RDS_PASSWORD="${RDS_PASSWORD:-}"
RESTORE_JOBS="${RESTORE_JOBS:-4}"

if [[ -z "${REPO_URL}" && ! -d "${APP_DIR}/.git" ]]; then
  fail "首次部署必須提供 REPO_URL。範例：REPO_URL=https://github.com/<owner>/<repo>.git bash scripts/ec2_one_click_deploy.sh"
fi

log "開始 EC2 一鍵部署"
log "APP_DIR=${APP_DIR}"
log "BRANCH=${BRANCH}"
log "DB_MIGRATION_MODE=${DB_MIGRATION_MODE}"

log "安裝系統套件與 Docker"
sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates docker.io docker-compose-plugin awscli postgresql-client pv

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

if [[ "${DB_MIGRATION_MODE}" == "s3_to_rds" ]]; then
  require_cmd aws
  require_cmd pg_restore

  [[ -n "${S3_DUMP_URI}" ]] || fail "DB_MIGRATION_MODE=s3_to_rds 時，必須提供 S3_DUMP_URI，例如 s3://my-bucket/db/stock_db.dump"
  [[ -n "${RDS_HOST}" ]] || fail "DB_MIGRATION_MODE=s3_to_rds 時，必須提供 RDS_HOST"
  [[ -n "${RDS_DB}" ]] || fail "DB_MIGRATION_MODE=s3_to_rds 時，必須提供 RDS_DB"
  [[ -n "${RDS_USER}" ]] || fail "DB_MIGRATION_MODE=s3_to_rds 時，必須提供 RDS_USER"
  [[ -n "${RDS_PASSWORD}" ]] || fail "DB_MIGRATION_MODE=s3_to_rds 時，必須提供 RDS_PASSWORD"

  DUMP_FILE="/tmp/stock_db_$(date +%s).dump"
  log "下載 dump：${S3_DUMP_URI} -> ${DUMP_FILE}"
  if [[ -n "${AWS_REGION}" ]]; then
    aws s3 cp "${S3_DUMP_URI}" "${DUMP_FILE}" --region "${AWS_REGION}"
  else
    aws s3 cp "${S3_DUMP_URI}" "${DUMP_FILE}"
  fi

  export PGPASSWORD="${RDS_PASSWORD}"
  log "開始還原到 RDS：${RDS_HOST}:${RDS_PORT}/${RDS_DB}（jobs=${RESTORE_JOBS}）"
  pg_restore \
    --host "${RDS_HOST}" \
    --port "${RDS_PORT}" \
    --username "${RDS_USER}" \
    --dbname "${RDS_DB}" \
    --clean --if-exists --no-owner --no-privileges \
    --jobs "${RESTORE_JOBS}" \
    "${DUMP_FILE}"

  log "清理暫存 dump"
  rm -f "${DUMP_FILE}"
  unset PGPASSWORD
  log "S3 -> RDS 還原完成"
fi

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
