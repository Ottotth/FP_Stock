#!/usr/bin/env bash
set -Eeuo pipefail

log(){ echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail(){ echo "[ERROR] $*" >&2; exit 1; }

# Usage: export EC2_USER EC2_HOST SSH_KEY_PATH APP_DIR then run
EC2_USER="${EC2_USER:-ubuntu}"
EC2_HOST="${EC2_HOST:-3.236.83.65}"
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/ec2-demo-key-pair.pem}"
APP_DIR="${APP_DIR:-/opt/fp_stock}"

if [[ ! -f "${SSH_KEY_PATH}" ]]; then
  fail "SSH key not found: ${SSH_KEY_PATH}"
fi

require_cmd(){ command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }
require_cmd docker
require_cmd scp
require_cmd ssh

TMP_DIR="/tmp/fp_images_$(date +%s)"
mkdir -p "${TMP_DIR}"

# Platform/build options
PLATFORM="${PLATFORM:-linux/amd64}"
USE_BUILDX="${USE_BUILDX:-true}"

log "1) Build images locally (backend/frontend) for platform=${PLATFORM}"
# Try to use buildx when available to build for target platform
if [[ "${USE_BUILDX}" == "true" && -x "$(command -v docker)" ]]; then
  if docker buildx version >/dev/null 2>&1; then
    log "Using docker buildx"
    # ensure builder
    docker buildx create --use >/dev/null 2>&1 || true
    docker buildx build --platform "${PLATFORM}" -t fp_stock_backend:latest --load _java/data-provider-app || {
      log "buildx backend build failed, falling back to plain build"
      DOCKER_DEFAULT_PLATFORM="${PLATFORM}" docker build -t fp_stock_backend:latest _java/data-provider-app || fail "backend build failed"
    }
    docker buildx build --platform "${PLATFORM}" -t fp_stock_frontend:latest --load _react/stock_react || {
      log "buildx frontend build failed, falling back to plain build"
      DOCKER_DEFAULT_PLATFORM="${PLATFORM}" docker build -t fp_stock_frontend:latest _react/stock_react || fail "frontend build failed"
    }
  else
    log "docker buildx not available; using DOCKER_DEFAULT_PLATFORM=${PLATFORM}"
    DOCKER_DEFAULT_PLATFORM="${PLATFORM}" docker build -t fp_stock_backend:latest _java/data-provider-app || fail "backend build failed"
    DOCKER_DEFAULT_PLATFORM="${PLATFORM}" docker build -t fp_stock_frontend:latest _react/stock_react || fail "frontend build failed"
  fi
else
  log "Skipping buildx; using default docker build"
  docker build -t fp_stock_backend:latest _java/data-provider-app || fail "backend build failed"
  docker build -t fp_stock_frontend:latest _react/stock_react || fail "frontend build failed"
fi

log "2) Save images to tar files"
# Determine compose-expected image tags (project-service:latest) and retag built images accordingly
PROJECT_NAME="$(basename "${APP_DIR}")"

# helper: find service name whose build.context matches a path fragment
find_service_for_context(){
  local ctx="$1";
  awk -v ctx="${ctx}" '
    /^\s*[a-zA-Z0-9_\-]+:\s*$/ { svc=$1; sub(":","",svc); in_service=1; next }
    in_service && /context\s*:/ { if ($0 ~ ctx) { print svc }; in_service=0; next }
    in_service && NF==0 { in_service=0 }
  ' docker-compose.yml
}

backend_svc=$(find_service_for_context "_java/data-provider-app" || true)
frontend_svc=$(find_service_for_context "_react/stock_react" || true)

backend_target_tag="${PROJECT_NAME}-${backend_svc:-data-provider-app}:latest"
frontend_target_tag="${PROJECT_NAME}-${frontend_svc:-heatmap-ui-app}:latest"

log "Retagging built images to compose-expected names: ${backend_target_tag}, ${frontend_target_tag}"
docker tag fp_stock_backend:latest "${backend_target_tag}" || log "warning: tagging backend failed"
docker tag fp_stock_frontend:latest "${frontend_target_tag}" || log "warning: tagging frontend failed"

docker save "${backend_target_tag}" -o "${TMP_DIR}/backend.tar"
docker save "${frontend_target_tag}" -o "${TMP_DIR}/frontend.tar"

log "3) Upload images and compose file to EC2"
ssh -i "${SSH_KEY_PATH}" "${EC2_USER}@${EC2_HOST}" "sudo mkdir -p ${APP_DIR} && sudo chown ${EC2_USER}:${EC2_USER} ${APP_DIR}"
scp -i "${SSH_KEY_PATH}" "${TMP_DIR}/backend.tar" "${EC2_USER}@${EC2_HOST}:${APP_DIR}/backend.tar"
scp -i "${SSH_KEY_PATH}" "${TMP_DIR}/frontend.tar" "${EC2_USER}@${EC2_HOST}:${APP_DIR}/frontend.tar"
scp -i "${SSH_KEY_PATH}" docker-compose.yml "${EC2_USER}@${EC2_HOST}:${APP_DIR}/docker-compose.yml"

log "4) Load images and run docker compose on EC2"
# Uploads done; now remotely load and verify images then start compose (no-build)
ssh -i "${SSH_KEY_PATH}" "${EC2_USER}@${EC2_HOST}" bash -lc "\
  sudo docker load -i ${APP_DIR}/backend.tar || true && \
  sudo docker load -i ${APP_DIR}/frontend.tar || true && \
  echo 'REMOTE: checking backend image exists' && sudo docker images --format '{{.Repository}}:{{.Tag}}' | grep -q '^fp_stock_backend:latest$' || exit 2 && \
  cd ${APP_DIR} && sudo docker compose up -d --remove-orphans --no-build" || {
  log "Remote docker load or compose failed or backend image not present; retrying image upload once"
  # retry upload backend only
  scp -i "${SSH_KEY_PATH}" "${TMP_DIR}/backend.tar" "${EC2_USER}@${EC2_HOST}:${APP_DIR}/backend.tar"
  ssh -i "${SSH_KEY_PATH}" "${EC2_USER}@${EC2_HOST}" bash -lc "sudo docker load -i ${APP_DIR}/backend.tar || true && sudo docker images --format '{{.Repository}}:{{.Tag}}' | grep -q '^fp_stock_backend:latest$' || exit 3 && cd ${APP_DIR} && sudo docker compose up -d --remove-orphans --no-build" || fail "remote load/compose retry failed"
}

log "5) Cleanup local temp files"
rm -rf "${TMP_DIR}"

log "done"
