package com.bootcamp.stock.data_provider_app.service.impl;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.bootcamp.stock.data_provider_app.config.lib.RedisManager;
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

  @Autowired
  private RedisManager redisManager;

  @Override
  public List<StockDataEntity> getRecent30DataEntity(String symbol,
      String interval) {
    String cacheKey = "recent30_" + symbol + "_" + interval;
    StockDataEntity[] cachedData =
        redisManager.get(cacheKey, StockDataEntity[].class);
    if (cachedData != null) {
      return Arrays.asList(cachedData);
    }

    List<StockDataEntity> entities =
        stockDataRepository.findRecent30DataEntity(symbol, interval);
    redisManager.set(cacheKey, entities.toArray(StockDataEntity[]::new),
        Duration.ofMinutes(2));
    return entities;
  }

    @Override
  public HeatMapDto getHeatMapData() {
    List<HeatMapEntity> heatMapEntities = heatMapRepository.findAll();
    return HeatMapDto.builder().heatMapData(heatMapEntities).build();
  }
}
