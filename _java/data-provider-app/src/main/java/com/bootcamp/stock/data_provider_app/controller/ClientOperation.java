package com.bootcamp.stock.data_provider_app.controller;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.dto.LastCandleDto;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.YahooNewsDTO;


public interface ClientOperation {

  @GetMapping("/heatMapData")
  HeatMapDto getHeatMapData();
  
  @GetMapping("/recent30Data")
  List<StockDataEntity> getRecent30DataEntity(@RequestParam String symbol, @RequestParam String interval);

  @GetMapping("/stockdata")
  List<StockDataEntity> getSymbolAndInterval(@RequestParam String symbol, @RequestParam String interval);

  @GetMapping("/lastcandle")
  LastCandleDto getLastCandle(@RequestParam String symbol,
      @RequestParam String interval);

  @GetMapping("/stockNews")
  YahooNewsDTO getYahooNews(@RequestParam String symbol,
      @RequestParam(defaultValue = "5") int newsCount);
}
