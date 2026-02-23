package com.bootcamp.stock.data_provider_app.controller;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;

public interface StockDataOperation {

  @GetMapping("/stockdata")
  List<StockDataEntity> getSymbolAndInterval(@RequestParam String symbol, @RequestParam String interval);

  @GetMapping("/updateStock")
  StockChartDTO updateStockChartData(@RequestParam String symbol, @RequestParam String interval);

  @GetMapping("/realTimeStock")
  RealTimeSTockDTO getRealTimeStockData(@RequestParam String symbol);

  @GetMapping("/oldStockData")
  List<OldStockDataEntity> getOldStockData(@RequestParam String symbol, @RequestParam String interval, @RequestParam int days);

  @GetMapping("/updateheatMapData")
  List<HeatMapEntity> updateHeatMapData();

  @GetMapping("/heatMapData")
  List<HeatMapEntity> getHeatMapData();

  @GetMapping("/allsymbols")
  List<String> getAllSymbols();
}
