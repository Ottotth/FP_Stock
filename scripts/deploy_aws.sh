#!/usr/bin/env bash
set -euo pipefail

# One-click deploy script for:
#  - Java backend (_java/data-provider-app) : build jar, upload to EC2, restart service
#  - React frontend (_react/stock_react) : build, upload to S3 (preferred) or EC2, restart nginx

# Usage: configure environment variables below, export them, or pass flags.
# Examples:
#  ./scripts/deploy_aws.sh                       # uses env/defaults
#  ./scripts/deploy_aws.sh --host 13.222.57.13   # override host
#  ONLY_BACKEND=true ./scripts/deploy_aws.sh    # only backend
#  ./scripts/deploy_aws.sh --only-backend       # same

#########################
# Configurable variables
#########################
# EC2 target for backend/frontend (if not using S3 for frontend)
EC2_USER="${EC2_USER:-ubuntu}"
EC2_HOST="${EC2_HOST:-13.222.57.13}" # required for SSH deploy (override with --host)
EC2_KEY_PATH="${EC2_KEY_PATH:-$HOME/.ssh/ec2-demo-key-pair.pem}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/home/ubuntu/app}" # directory where jar will be placed
JAVA_SERVICE_NAME="${JAVA_SERVICE_NAME:-data-provider-app}" # systemd service name to restart

# Frontend options
FRONTEND_S3_BUCKET="${FRONTEND_S3_BUCKET:-}" # if set, upload frontend to this S3 bucket (aws cli required)
REMOTE_FRONTEND_DIR="${REMOTE_FRONTEND_DIR:-/var/www/html}" # used when uploading via scp

# Build toggles
SKIP_TESTS="${SKIP_TESTS:-true}"
ONLY_BACKEND="${ONLY_BACKEND:-false}"
ONLY_FRONTEND="${ONLY_FRONTEND:-false}"
WAIT_PORT_TIMEOUT="${WAIT_PORT_TIMEOUT:-30}"

#########################
function check_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "Required command '$1' not found" >&2; exit 2; }
}

function usage() {
  cat <<EOF
Usage: $0 [options]
Options:
  --host HOST             override EC2 host (or set EC2_HOST env)
  --user USER             override EC2 user (or set EC2_USER env)
  --key PATH              SSH key path (or set EC2_KEY_PATH env)
  --only-backend          deploy only backend
  --only-frontend         deploy only frontend
  --skip-tests            skip maven tests (set SKIP_TESTS=true)
  -h, --help              show this help
EOF
  exit 0
}

# simple arg parsing
while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) EC2_HOST="$2"; shift 2;;
    --user) EC2_USER="$2"; shift 2;;
    --key) EC2_KEY_PATH="$2"; shift 2;;
    --only-backend) ONLY_BACKEND=true; shift;;
    --only-frontend) ONLY_FRONTEND=true; shift;;
    --skip-tests) SKIP_TESTS=true; shift;;
    -h|--help) usage; shift;;
    *) echo "Unknown arg: $1"; usage;;
  esac
done

echo "Starting one-click deploy..."

echo "Checking required tools..."
check_command ssh
check_command scp
check_command awk
check_command sha256sum || true

# Java build
echo "Building Java backend..."
pushd _java/data-provider-app >/dev/null
if [ -f ./mvnw ]; then
  chmod +x ./mvnw
  if [ "$SKIP_TESTS" = "true" ]; then
    ./mvnw clean package -DskipTests
  else
    ./mvnw clean package
  fi
else
  check_command mvn
  if [ "$SKIP_TESTS" = "true" ]; then
    mvn clean package -DskipTests
  else
    mvn clean package
  fi
fi

# find built jar (exclude .original)
JAR_REL_PATH=$(ls -t target/*.jar 2>/dev/null | grep -v '\.original' | head -n1 || true)
if [ -z "$JAR_REL_PATH" ]; then
  echo "Failed to find built JAR in target/. Aborting." >&2
  popd >/dev/null
  exit 3
fi
# convert to absolute path before leaving directory
JAR_PATH="$(pwd)/${JAR_REL_PATH}"
echo "Built JAR: $JAR_PATH"
popd >/dev/null

# Upload jar to EC2 and restart service (upload to /tmp first then move with sudo)
if [ -n "$EC2_HOST" ]; then
  JAR_BASENAME="$(basename "$JAR_PATH")"
  TMP_REMOTE="/tmp/$JAR_BASENAME.$(date +%s)"
  echo "Uploading backend jar to $EC2_USER@$EC2_HOST:$TMP_REMOTE (upload to writable /tmp then move with sudo)"
  scp -i "$EC2_KEY_PATH" "$JAR_PATH" "$EC2_USER@$EC2_HOST:$TMP_REMOTE"
  echo "Installing backend jar on remote host ($EC2_HOST)"
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" \
    "set -euo pipefail; sudo mkdir -p '$REMOTE_APP_DIR' && sudo chown root:root '$REMOTE_APP_DIR' || true; \
     if [ -f '$REMOTE_APP_DIR/app.jar' ]; then TS=\$(date +%s); sudo mv -f '$REMOTE_APP_DIR/app.jar' '$REMOTE_APP_DIR/${JAR_BASENAME}.bak.'\$TS || true; fi; \
     sudo mv -f '$TMP_REMOTE' '$REMOTE_APP_DIR/app.jar'; \
     sudo chown ubuntu:ubuntu '$REMOTE_APP_DIR/app.jar' || true; \
     echo 'REMOTE_SHA='\$(sha256sum '$REMOTE_APP_DIR/app.jar' | awk '{print \$1}') > /tmp/remote_jar.sha || true;"

  # verify checksum
  if command -v sha256sum >/dev/null 2>&1; then
    LOCAL_SHA=$(sha256sum "$JAR_PATH" | awk '{print $1}') || true
    REMOTE_SHA=$(ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "cat /tmp/remote_jar.sha 2>/dev/null || true" | sed -n 's/REMOTE_SHA=//p' || true)
    if [ -n "$REMOTE_SHA" ] && [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
      echo "ERROR: uploaded JAR checksum mismatch (local:$LOCAL_SHA remote:$REMOTE_SHA). Aborting." >&2
      exit 4
    else
      echo "Uploaded JAR checksum OK: $LOCAL_SHA"
    fi
  fi

  echo "Restarting service ($JAVA_SERVICE_NAME) on remote host"
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "if sudo systemctl list-units --full -all | grep -Fq '$JAVA_SERVICE_NAME.service'; then sudo systemctl daemon-reload || true; sudo systemctl restart '$JAVA_SERVICE_NAME' || true; else sudo pkill -f 'java -jar .*app.jar' || true; nohup java -jar '$REMOTE_APP_DIR/app.jar' > '$REMOTE_APP_DIR/nohup.out' 2>&1 & disown || true; fi"

  echo "Waiting for remote app to listen on 127.0.0.1:8080 (timeout ${WAIT_PORT_TIMEOUT}s)"
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "for i in \\$(seq 1 $WAIT_PORT_TIMEOUT); do sudo ss -ltnp 2>/dev/null | grep -q ':8080' && echo LISTEN_OK && exit 0 || sleep 1; done; echo LISTEN_TIMEOUT; exit 1" || true

  # remote health check
  echo "Remote health check (via localhost on remote host)"
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "curl -sS --max-time 5 http://127.0.0.1:8080/actuator/health || curl -sS --max-time 5 http://127.0.0.1:8080/ || true"
else
  echo "EC2_HOST not set — skipped uploading backend jar. Export EC2_HOST and re-run to deploy." >&2
fi

# Frontend build
if [ "$ONLY_BACKEND" = "true" ]; then
  echo "ONLY_BACKEND=true: skipping frontend build/upload"
else
  echo "Building React frontend..."
fi
pushd _react/stock_react >/dev/null
if [ -f package.json ]; then
  check_command npm
  if [ "$ONLY_BACKEND" = "true" ]; then
    echo "Skipping frontend build because ONLY_BACKEND=true"
  else
    npm ci
    npm run build
  fi
else
  echo "No package.json found in _react/stock_react. Skipping frontend build." >&2
fi

# determine build dir (vite usually uses dist)
BUILD_DIR="dist"
if [ ! -d "$BUILD_DIR" ]; then
  if [ -d "build" ]; then
    BUILD_DIR="build"
  fi
fi
if [ ! -d "$BUILD_DIR" ]; then
  echo "Frontend build directory not found (dist/ or build/). Skipping frontend deploy." >&2
  popd >/dev/null
else
  echo "Frontend build produced: $BUILD_DIR"
  if [ -n "$FRONTEND_S3_BUCKET" ]; then
    check_command aws
    echo "Uploading frontend to S3 bucket: $FRONTEND_S3_BUCKET"
    aws s3 sync "$BUILD_DIR/" "s3://$FRONTEND_S3_BUCKET/" --delete
    echo "S3 upload complete. (Make sure bucket is set up for static hosting / CloudFront.)"
  elif [ -n "$EC2_HOST" ]; then
    if [ "$ONLY_FRONTEND" = "true" ] || [ "$ONLY_BACKEND" = "false" ]; then
      echo "Uploading frontend to $EC2_USER@$EC2_HOST:$REMOTE_FRONTEND_DIR"
  TS=$(date +%s)
  TMP_UPLOAD="/tmp/frontend_deploy_$TS"
  # create tmp dir on remote then scp files into it
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "mkdir -p $TMP_UPLOAD"
  scp -i "$EC2_KEY_PATH" -r "$BUILD_DIR/"* "$EC2_USER@$EC2_HOST:$TMP_UPLOAD/"
  echo "Moving frontend into $REMOTE_FRONTEND_DIR with sudo on remote host"
  ssh -i "$EC2_KEY_PATH" "$EC2_USER@$EC2_HOST" "sudo mkdir -p $REMOTE_FRONTEND_DIR; sudo rm -rf $REMOTE_FRONTEND_DIR/*; sudo cp -r $TMP_UPLOAD/* $REMOTE_FRONTEND_DIR/; sudo chown -R www-data:www-data $REMOTE_FRONTEND_DIR 2>/dev/null || true; sudo systemctl restart nginx || true; rm -rf $TMP_UPLOAD"
    else
      echo "Skipping frontend upload due to ONLY_BACKEND=true"
    fi
  else
    echo "Neither FRONTEND_S3_BUCKET nor EC2_HOST provided — frontend upload skipped." >&2
  fi
  popd >/dev/null
fi

echo "Deploy finished. Verify backend and frontend are serving the new versions."
