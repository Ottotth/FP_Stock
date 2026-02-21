package com.bootcamp.stock.data_provider_app.mapper;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;

@Component
public class DtoMapper {

  public List<HeatMapEntity> mapRealTimeStockDataToHeatMapEntity(
      RealTimeSTockDTO realTimeStockData) {
    List<HeatMapEntity> heatMapData = new ArrayList<>();
    if (realTimeStockData != null) {
      for (RealTimeSTockDTO.Result result : realTimeStockData.getQuoteResponse()
          .getResult()) {
        HeatMapEntity heatMapEntity = new HeatMapEntity();
        heatMapEntity.setSymbol(result.getSymbol());
        heatMapEntity.setCurrentPrice(result.getRegularMarketPrice());
        heatMapEntity.setPriceChange(result.getRegularMarketChange());
        heatMapEntity.setChangePercent(result.getRegularMarketChangePercent());
        heatMapEntity.setVolume(result.getRegularMarketVolume());
        heatMapData.add(heatMapEntity);
      }
    }
    return heatMapData;
  }
}
