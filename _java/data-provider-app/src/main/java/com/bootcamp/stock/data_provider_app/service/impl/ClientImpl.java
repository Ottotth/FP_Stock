package com.bootcamp.stock.data_provider_app.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.repository.HeatMapRepository;
import com.bootcamp.stock.data_provider_app.repository.StockDataRepository;
import com.bootcamp.stock.data_provider_app.service.ClientService;

@Service
public class ClientImpl implements ClientService {

  @Autowired
  private StockDataRepository stockDataRepository;

  @Autowired
  private HeatMapRepository heatMapRepository;

  @Override
  public List<StockDataEntity> getRecent30DataEntity(String symbol,
      String interval) {
    return stockDataRepository.findRecent30DataEntity(symbol, interval);
  }

    @Override
  public HeatMapDto getHeatMapData() {
    List<HeatMapEntity> heatMapEntities = heatMapRepository.findAll();
    return HeatMapDto.builder().heatMapData(heatMapEntities).build();
  }
}
