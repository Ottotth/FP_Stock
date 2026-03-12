FROM node:18-alpine AS node-build
WORKDIR /frontend
COPY _react/stock_react/ ./
RUN npm ci --silent && npm run build

FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy backend sources (relative to repository root when build context is repository)
COPY _java/data-provider-app/pom.xml ./pom.xml
COPY _java/data-provider-app/src ./src

# Copy frontend build into Spring Boot static resources so it is packaged into the jar
COPY --from=node-build /frontend/dist ./src/main/resources/static

RUN mvn -B -DskipTests clean package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar /app/app.jar
# install redis-server (Debian-based image)
USER root
RUN apt-get update && apt-get install -y redis-server && rm -rf /var/lib/apt/lists/*

COPY _java/data-provider-app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8080 6379
ENTRYPOINT ["/app/docker-entrypoint.sh"]
