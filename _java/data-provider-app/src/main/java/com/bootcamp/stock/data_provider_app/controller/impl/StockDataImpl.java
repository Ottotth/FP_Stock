package com.bootcamp.stock.data_provider_app.controller.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.bootcamp.stock.data_provider_app.config.StockUpdater;
import com.bootcamp.stock.data_provider_app.controller.StockDataOperation;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;
import com.bootcamp.stock.data_provider_app.service.StockDataService;

@RestController
public class StockDataImpl implements StockDataOperation {

  @Autowired
  private StockDataService stockDataService;

  @Autowired
  private StockUpdater stockUpdater;

  @Override
  public List<StockDataEntity> getSymbolAndInterval(@RequestParam String symbol,
      @RequestParam String interval) {
    return stockDataService.getBySymbolAndInterval(symbol, interval);
  }

  @Override
  public StockChartDTO updateStockChartData(@RequestParam String symbol,
      @RequestParam String interval) {
    return stockDataService.updateStockChartData(symbol, interval);
  }

  @Override
  public RealTimeSTockDTO getRealTimeStockData(@RequestParam String symbol) {
    return stockDataService.getRealTimeStockData(symbol);
  }

  @Override
  public List<OldStockDataEntity> getOldStockData(@RequestParam String symbol,
      @RequestParam String interval, @RequestParam int days) {
    return stockDataService.getOldStockData(symbol, interval, days);
  }

  @Override
  public HeatMapDto updateHeatMapData() {
    return stockDataService.updateHeatMapData();
  }

  @Override
  public List<String> getAllSymbols() {
    return stockDataService.getAllSymbols();
  }

  @Override
  public String updateAllData() {
    stockUpdater.updateAllStockData();
    stockUpdater.updateOldData();
    return "All data updated successfully";
  }
}
