package com.bootcamp.stock.data_provider_app.service;

import java.util.List;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;


public interface StockDataService {
  
List<StockDataEntity> getBySymbolAndInterval(String symbol , String interval);

StockChartDTO updateStockChartData(String symbol, String interval);

RealTimeSTockDTO getRealTimeStockData(String symbol);

List<OldStockDataEntity> getOldStockData(String symbol, String interval, int days);

List<HeatMapEntity> updateHeatMapData();

List<HeatMapEntity> getHeatMapData();

List<String> getAllSymbols();
}
