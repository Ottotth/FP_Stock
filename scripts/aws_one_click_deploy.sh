#!/usr/bin/env bash
set -euo pipefail

###############################################
# one-click 部署腳本（繁體中文）
# 說明：
# - 本腳本在本機 build 前端與後端，將產物上傳到指定 EC2，
#   在 EC2 安裝 Java/Postgres/Redis（與 nginx 可選），建立 systemd 服務以啟動 Spring Boot。
# - 腳本使用變數集中管理，請先修改下方變數為你的環境再執行。
###############################################

##### 可編輯變數（請務必修改）
EC2_HOST="100.31.126.48"                # 例如 1.2.3.4
EC2_USER="ubuntu"          # SSH user（ec2-user / ubuntu）
SSH_KEY_PATH="$HOME/.ssh/ec2-demo-key-pair.pem" # 私鑰路徑

APP_USER="ubuntu"        # 在 EC2 上的帳號（用於放檔案）
APP_DIR="/home/${APP_USER}/app"

# 本地檔路徑（相對於 repo root）
LOCAL_JAR_PATH="_java/data-provider-app/target/data-provider-app-0.0.1-SNAPSHOT.jar"
LOCAL_FRONTEND_DIR="_react/stock_react/dist"

# 選項
INSTALL_NGINX=true          # true/false：是否在 EC2 安裝 nginx 並 proxy
INSTALL_POSTGRES=true       # true/false：是否在 EC2 安裝並初始化 PostgreSQL
INSTALL_REDIS=true          # true/false：是否在 EC2 安裝並啟用 Redis
RESTORE_DB=false            # true/false：上傳並還原本地 db dump
LOCAL_DB_DUMP="./stock_db_full.dump.gz" # 若 RESTORE_DB=true，請先產生此檔

# 應用設定（你會手動修改這些環境變數）
ENV_DB_NAME="stock_db"
ENV_DB_USER="postgres"
ENV_DB_PASSWORD="admin1234"
ENV_REDIS_HOST="127.0.0.1"
ENV_REDIS_PORT="6379"

# 版本設定
JAVA_VERSION=21
POSTGRES_VERSION=18

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes -i ${SSH_KEY_PATH}"

if [ -z "${EC2_HOST}" ]; then
  echo "請先編輯腳本上方變數 EC2_HOST、SSH_KEY_PATH 等後再執行。"
  exit 1
fi

echo "==== 開始 one-click 部署流程 ===="

echo "Step 1: 本機 build 前端（Vite）與後端（Maven）"
echo "- 前端 build"
(cd _react/stock_react && npm ci --silent && npm run build)

echo "- 後端 build"
(cd _java/data-provider-app && mvn -B -DskipTests clean package)

echo "Step 2: 打包前端、準備上傳檔案"
FRONT_TAR="/tmp/frontend_dist_$$.tar.gz"
tar -C "${LOCAL_FRONTEND_DIR}" -czf "${FRONT_TAR}" .

if [ ! -f "${LOCAL_JAR_PATH}" ]; then
  echo "找不到 jar：${LOCAL_JAR_PATH}，請確認 build 成功。"
  exit 1
fi

echo "Step 3: 上傳檔案到 EC2 (${EC2_HOST})"
ssh ${SSH_OPTS} ${EC2_USER}@${EC2_HOST} "sudo mkdir -p ${APP_DIR} && sudo chown ${APP_USER}:${APP_USER} ${APP_DIR} || true"
scp ${SSH_OPTS} "${LOCAL_JAR_PATH}" ${EC2_USER}@${EC2_HOST}:${APP_DIR}/app.jar
scp ${SSH_OPTS} "${FRONT_TAR}" ${EC2_USER}@${EC2_HOST}:${APP_DIR}/frontend.tar.gz

if [ "${RESTORE_DB}" = true ]; then
  if [ ! -f "${LOCAL_DB_DUMP}" ]; then
    echo "設定要還原 DB，但找不到 ${LOCAL_DB_DUMP}。請先產生並重試。"
    exit 1
  fi
  scp ${SSH_OPTS} "${LOCAL_DB_DUMP}" ${EC2_USER}@${EC2_HOST}:${APP_DIR}/
fi

echo "Step 4: 在 EC2 上安裝依賴並部署應用（需要 sudo 權限）"
ssh ${SSH_OPTS} ${EC2_USER}@${EC2_HOST} "JAVA_VERSION='${JAVA_VERSION}' POSTGRES_VERSION='${POSTGRES_VERSION}' INSTALL_NGINX='${INSTALL_NGINX}' INSTALL_POSTGRES='${INSTALL_POSTGRES}' INSTALL_REDIS='${INSTALL_REDIS}' LOCAL_DB_DUMP='${LOCAL_DB_DUMP}' RESTORE_DB='${RESTORE_DB}' APP_USER='${APP_USER}' bash -s" <<'REMOTE'
set -euo pipefail
# ensure defaults for variables that may be unset when running remotely
APP_USER="${APP_USER:-ubuntu}"
RESTORE_DB="${RESTORE_DB:-false}"
LOCAL_DB_DUMP="${LOCAL_DB_DUMP:-}"
APP_DIR="/home/${APP_USER}/app"
FRONT_TAR="${APP_DIR}/frontend.tar.gz"
JAR_PATH="${APP_DIR}/app.jar"

# 偵測 package manager
PKG_MGR=unknown
if [ -f /etc/debian_version ]; then
  PKG_MGR="apt"
  sudo apt update -y
elif [ -f /etc/alpine-release ]; then
  PKG_MGR="apk"
elif [ -f /etc/system-release ] || [ -f /etc/os-release ]; then
  PKG_MGR="yum"
fi

echo "Detected package manager: ${PKG_MGR}"


echo "Install Java ${JAVA_VERSION}, Redis, Postgres ${POSTGRES_VERSION}, Nginx as configured"
if [ "${PKG_MGR}" = "apt" ]; then
  # Try installing OpenJDK 21, fallback to OpenJDK 17
  sudo apt-get update -y
  if apt-cache show openjdk-${JAVA_VERSION}-jre-headless >/dev/null 2>&1; then
    # ensure PostgreSQL Apt repo exists for specific major versions
    if ! apt-cache show postgresql-${POSTGRES_VERSION} >/dev/null 2>&1; then
      echo "加入 PostgreSQL Apt Repository for version ${POSTGRES_VERSION}"
      wget -qO - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add - || true
      CODENAME=$(lsb_release -cs)
      echo "deb http://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list
      sudo apt-get update -y
    fi
    sudo apt-get install -y openjdk-${JAVA_VERSION}-jre-headless redis-server nginx postgresql-${POSTGRES_VERSION} postgresql-contrib
  else
    sudo apt-get install -y openjdk-17-jre-headless redis-server nginx postgresql postgresql-contrib
  fi
elif [ "${PKG_MGR}" = "yum" ]; then
  # Try Amazon Corretto 21 or OpenJDK 21 if available, fallback to 17
  sudo yum install -y java-${JAVA_VERSION}-amazon-corretto-devel || sudo yum install -y java-${JAVA_VERSION}-openjdk || sudo yum install -y java-17-openjdk || true
  # Attempt to install postgres ${POSTGRES_VERSION}; fallback to default package
  sudo yum install -y redis nginx postgresql${POSTGRES_VERSION}-server postgresql${POSTGRES_VERSION}-contrib || sudo yum install -y postgresql-server postgresql-contrib || true
  if [ -f /usr/bin/postgresql-setup ]; then
    sudo postgresql-setup --initdb || true
  fi
  sudo systemctl enable --now postgresql || true
fi

# 啟用與設定 Redis
sudo systemctl enable --now redis || sudo systemctl enable --now redis-server || true

# 解壓 frontend
sudo mkdir -p ${APP_DIR}/static
sudo tar -C ${APP_DIR}/static -xzf "${FRONT_TAR}"
sudo chown -R ${APP_USER}:${APP_USER} ${APP_DIR}

# 建立 .env（請按需修改）
cat > /tmp/app_env <<EOF
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=stock_db
DB_USER=postgres
DB_PASSWORD=admin1234
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
EOF
sudo mv /tmp/app_env ${APP_DIR}/.env
sudo chown ${APP_USER}:${APP_USER} ${APP_DIR}/.env

# 初始化 Postgres 使用者與資料庫（若安裝）
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'admin1234';" || true
sudo -u postgres psql -c "CREATE DATABASE stock_db OWNER postgres;" || true

# 建立 systemd service
cat > /tmp/data-provider.service <<SERVICE
[Unit]
Description=Data Provider App
After=network.target

[Service]
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/.env
ExecStart=/usr/bin/java -jar ${APP_DIR}/app.jar
SuccessExitStatus=143
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE

sudo mv /tmp/data-provider.service /etc/systemd/system/data-provider.service
sudo systemctl daemon-reload
sudo systemctl enable --now data-provider.service

echo "若設定 nginx，建立 proxy 與 static config（若 nginx 已安裝且啟用）"
if [ "${INSTALL_NGINX}" = true ]; then
  cat > /tmp/app_nginx.conf <<NGINX
server {
  listen 80;
  server_name _;
  root ${APP_DIR}/static;
  index index.html;

  location / {
    try_files \$uri \$uri/ @backend;
  }
  location @backend {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
  location ~* \.(?:jpg|jpeg|gif|png|css|js|svg|ico)$ {
    expires 30d;
    add_header Cache-Control "public";
  }
}
NGINX
  sudo mv /tmp/app_nginx.conf /etc/nginx/conf.d/app.conf
  sudo nginx -t || true
  sudo systemctl enable --now nginx || true
fi

# 若需要還原 DB（local dump 已上傳）
if [ "${RESTORE_DB}" = true ]; then
  if [ -f "${APP_DIR}/$(basename ${LOCAL_DB_DUMP})" ]; then
    sudo -u postgres bash -c "gunzip -c ${APP_DIR}/$(basename ${LOCAL_DB_DUMP}) > /tmp/restore.dump && pg_restore -d stock_db /tmp/restore.dump"
  else
    echo "找不到要還原的 dump 檔，跳過還原。"
  fi
fi

echo "部署完成。請檢查 systemd 與日誌： sudo journalctl -u data-provider.service -f"
REMOTE

echo "清理本地暫存"
rm -f "${FRONT_TAR}"

echo "部署腳本執行完成。應用位置： http://${EC2_HOST}/ (若 nginx 已啟用並綁定 80) 或 http://${EC2_HOST}:8080/"

exit 0
