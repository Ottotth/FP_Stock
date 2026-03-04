package com.bootcamp.stock.data_provider_app.controller.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.bootcamp.stock.data_provider_app.controller.ClientOperation;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.YahooNewsDTO;
import com.bootcamp.stock.data_provider_app.service.ClientService;
import com.bootcamp.stock.data_provider_app.service.StockDataService;

@RestController
public class ClientController implements ClientOperation {

  @Autowired
  private ClientService clientService;

  @Autowired
  private StockDataService stockDataService;

  @Override
  public HeatMapDto getHeatMapData() {
    return clientService.getHeatMapData();
  }

  @Override
  public List<StockDataEntity> getRecent30DataEntity(@RequestParam String symbol, @RequestParam String interval) {
    return clientService.getRecent30DataEntity(symbol, interval);
  }

  @Override
  public List<StockDataEntity> getSymbolAndInterval(@RequestParam String symbol,
      @RequestParam String interval) {
    stockDataService.updateStockChartData(symbol, interval);
    return stockDataService.getBySymbolAndInterval(symbol, interval);
  }

  @Override
  public YahooNewsDTO getYahooNews(@RequestParam String symbol,
      @RequestParam(defaultValue = "5") int newsCount) {
    return clientService.getYahooNews(symbol, newsCount);
  }
}

