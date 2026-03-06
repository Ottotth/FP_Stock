# FP_Stock

-- Read all Stock Data By Symbol and Interval From DataBase
-- Updata Stock Data By Symbol and Interval From Today to Newest Date in DataBase
-- Move the old Stock Data to other Table
-- Scheduler: In Weekday 06:00 UTC update all stock data
              In Weekday 07:00 UTC move the old Stock Data to other Table
-- Read the Real-time Stock Data
-- Update Realtime data for HeatMap
-- Get all Realtime data for HeatMap

## Docker Quick Start (Java + React)

1. Create environment file from template:

```bash
cp .env.example .env
```

2. Build and start all services:

```bash
docker compose up --build -d
```

3. Open apps:

- React UI: http://localhost:5173
- Java API: http://localhost:8080

4. Stop services:

```bash
docker compose down
```

## EC2 一鍵部署（Java + React）

1. 將專案放到 EC2（或在 EC2 直接 clone）後，進入專案根目錄並執行：

```bash
chmod +x scripts/ec2_one_click_deploy.sh
REPO_URL=https://github.com/<owner>/<repo>.git BRANCH=main APP_DIR=/opt/fp_stock bash scripts/ec2_one_click_deploy.sh
```

2. 若是第二次之後更新部署，可直接執行：

```bash
APP_DIR=/opt/fp_stock BRANCH=main bash scripts/ec2_one_click_deploy.sh
```

3. 完成後開啟：

- Frontend: http://<EC2_PUBLIC_IP>:5173
- Backend: http://<EC2_PUBLIC_IP>:8080

> 首次執行若被加入 docker 群組，請重新登入 EC2 一次，之後才可不帶 sudo 使用 docker。

## EC2 部署時同步做 S3 -> RDS 還原（可選）

若你已先把 `pg_dump -Fc` 的 dump 檔上傳到 S3，可在部署時一起還原到 RDS：

```bash
APP_DIR=/opt/fp_stock \
BRANCH=main \
DB_MIGRATION_MODE=s3_to_rds \
S3_DUMP_URI=s3://<your-bucket>/db/stock_db.dump \
AWS_REGION=ap-southeast-1 \
RDS_HOST=<your-rds-endpoint> \
RDS_PORT=5432 \
RDS_DB=stock_db \
RDS_USER=<your-rds-user> \
RDS_PASSWORD='<your-rds-password>' \
RESTORE_JOBS=4 \
bash scripts/ec2_one_click_deploy.sh
```

說明：
- 預設 `DB_MIGRATION_MODE=none`，不會做資料還原。
- 設為 `s3_to_rds` 時，腳本會先下載 S3 dump 到 `/tmp`，再執行 `pg_restore`。
- 若不想部署時還原，可先跑一般部署，之後再以同組參數單獨執行一次。

