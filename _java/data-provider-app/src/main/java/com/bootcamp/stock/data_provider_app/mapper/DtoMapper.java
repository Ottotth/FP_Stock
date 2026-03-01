package com.bootcamp.stock.data_provider_app.mapper;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.repository.SPListRepository;

@Component
public class DtoMapper {

  @Autowired
  private SPListRepository spListRepository;

  public HeatMapDto mapRealTimeStockDataToHeatMapDto(
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
        heatMapEntity.setGicsSector(spListRepository.findGicsSectorBySymbol(result.getSymbol()));
        heatMapEntity.setSecurity(spListRepository.findSecurityBySymbol(result.getSymbol()));
        heatMapEntity.setMarketCap(result.getMarketCap());
        heatMapEntity.setRegularMarketDayHigh(result.getRegularMarketDayHigh());
        heatMapEntity.setRegularMarketDayLow(result.getRegularMarketDayLow());
        heatMapData.add(heatMapEntity);
      }
    }
    return HeatMapDto.builder().heatMapData(heatMapData).build();
  }
}
