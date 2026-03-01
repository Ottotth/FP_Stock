# 檔案結構與用途

| 檔案路徑 | 用途說明 |
|---|---|
| DataProviderAppApplication.java | Spring Boot 主程式入口 |
| controller/StockDataOperation.java | API 介面定義 |
| controller/impl/StockDataImpl.java | API 實作，處理請求 |
| service/StockDataService.java | Service 介面 |
| service/impl/StockDataServiceImpl.java | Service 實作，商業邏輯/批次/快取 |
| repository/StockDataRepository.java | 股票資料 JPA 存取 |
| repository/OldStockDataRepository.java | 舊資料 JPA 存取 |
| repository/HeatMapRepository.java | HeatMap JPA 存取 |
| repository/SPListRepository.java | 股票清單 JPA 存取 |
| entity/StockDataEntity.java | 股票歷史資料 Entity |
| entity/OldStockDataEntity.java | 舊股票資料 Entity |
| entity/HeatMapEntity.java | HeatMap Entity |
| entity/SPListEntity.java | 股票清單 Entity |
| model/dto/StockChartDTO.java | Yahoo 歷史走勢 DTO |
| model/dto/RealTimeSTockDTO.java | Yahoo 即時報價 DTO |
| model/enums/Interval.java | 時間區間 Enum |
| mapper/EntityMapper.java | DTO/Entity 轉換 |
| mapper/DtoMapper.java | DTO 轉 HeatMapEntity 等 |
| config/AppConfig.java | Spring 設定 |
| config/AppScheduler.java | 排程任務設定 |
| config/StockUpdater.java | 批次更新邏輯 |
| config/AppRunner.java | 啟動初始化任務 |
| config/lib/RedisManager.java | Redis 快取管理 |
| Test.java | 測試用檔案 |
| src/test/java/DataProviderAppApplicationTests.java | Spring Boot 測試主程式 |


# Data Provider App (Spring Boot)

## 專案簡介
本專案為股票資料後端服務，使用 Spring Boot + JPA + PostgreSQL，提供股票歷史資料、即時報價、Heatmap/Treemap 資料、資料快取與批次更新等 API，並具備高效能批次寫入與查詢優化。

## 主要功能
- 提供 RESTful API 查詢股票歷史資料、即時報價、Heatmap/Treemap 資料
- 支援依 symbol/interval 查詢與快取（Redis）
- 從 Yahoo Finance 自動抓取最新股價與歷史走勢
- 批次更新資料時自動判斷新舊資料，避免 N+1 查詢，提升寫入效能
- 支援資料自動歸檔（舊資料轉存 OldStockDataEntity）
- Hibernate SQL/參數綁定/Service 層皆有詳細日誌，方便除錯
- 支援 HeatMap/Treemap 前端需求（群組、成交量、分群等）

## 主要 API
- `/stockdata?symbol=XXX&interval=YYY`：查詢指定股票歷史資料
- `/realTimeStock?symbol=XXX`：查詢即時報價
- `/updateStock?symbol=XXX&interval=YYY`：強制更新指定股票資料
- `/heatMapData`：取得 Heatmap/Treemap 資料
- `/updateheatMapData`：批次更新 Heatmap 資料
- `/allsymbols`：取得所有支援的股票代碼
- 

## 技術重點
- Spring Boot 3.x + Spring Data JPA + PostgreSQL
- Redis 快取（減少 DB 負載）
- Hibernate 批次查詢/寫入優化（避免 N+1 問題）
- EntityManager.persist 新增、saveAll 批次更新
- RESTful API 設計
- 詳細 logging 設定（SQL、參數、呼叫堆疊）

## 如何啟動
1. 安裝 PostgreSQL 並建立資料庫 `stock_db`
2. 設定 `application.yml` 連線資訊
3. 於專案目錄執行：
   ```bash
   ./mvnw spring-boot:run
   ```
4. 伺服器預設監聽於 `http://localhost:8080`

## 其他
- 前端（React）請見 `_react/stock_react` 目錄
- Python 抓取/資料處理請見 `_py` 目錄

---
如需協助或有 bug，請聯絡專案維護者。
