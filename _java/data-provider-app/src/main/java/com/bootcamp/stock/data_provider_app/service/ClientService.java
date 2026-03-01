package com.bootcamp.stock.data_provider_app.service;

import java.util.List;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;

public interface ClientService {
  
  List<StockDataEntity> getRecent30DataEntity(String symbol , String interval);

  HeatMapDto getHeatMapData();
}
