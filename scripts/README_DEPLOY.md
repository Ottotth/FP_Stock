**Deploy script usage**

This repository contains `scripts/deploy_aws.sh` — a one-click deploy helper to:

- Build the Java backend located at `_java/data-provider-app` (uses `./mvnw` if present).
- Build the React frontend located at `_react/stock_react` (uses `npm ci` + `npm run build`).
- Upload the backend jar to an EC2 host and restart the service, or skip if `EC2_HOST` is not set.
- Upload the frontend to an S3 bucket (`FRONTEND_S3_BUCKET`) or to EC2 (`REMOTE_FRONTEND_DIR`) via `scp`.

Environment variables (examples):

- `EC2_USER` (default: `ubuntu`)
- `EC2_HOST` (required for SSH deployment)
- `EC2_KEY_PATH` (default: `~/.ssh/id_rsa`)
- `REMOTE_APP_DIR` (default: `/home/ubuntu/app`)
- `JAVA_SERVICE_NAME` (default: `data-provider-app`)
- `FRONTEND_S3_BUCKET` (if set, script will `aws s3 sync` the built frontend)
- `REMOTE_FRONTEND_DIR` (default: `/var/www/html` for scp upload)
- `SKIP_TESTS` (default: `true`)

Examples:

Deploy via SSH (backend + frontend copied to EC2):
```
EC2_USER=ubuntu EC2_HOST=1.2.3.4 EC2_KEY_PATH=~/.ssh/mykey.pem REMOTE_APP_DIR=/home/ubuntu/app REMOTE_FRONTEND_DIR=/var/www/html ./scripts/deploy_aws.sh
```

Deploy frontend to S3 and backend to EC2:
```
FRONTEND_S3_BUCKET=my-frontend-bucket EC2_USER=ubuntu EC2_HOST=1.2.3.4 EC2_KEY_PATH=~/.ssh/mykey.pem ./scripts/deploy_aws.sh
```

Notes:
- The script assumes you have `aws` CLI configured when using `FRONTEND_S3_BUCKET`.
- You may want to secure the EC2 key and use a CI/CD runner instead of running locally.
- For production safety (prevent race conditions and ensure atomic last-candle merges), consider implementing Redis Lua merge and/or add health checks in the deploy pipeline.
