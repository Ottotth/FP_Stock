#!/bin/sh
set -e

# Try to start redis-server (Debian). If service command not available, run redis-server directly.
if command -v service >/dev/null 2>&1; then
  service redis-server start || redis-server --daemonize yes
else
  redis-server --daemonize yes
fi

# Run the Spring Boot jar
exec java -jar /app/app.jar
