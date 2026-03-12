package com.bootcamp.stock.data_provider_app.service.impl;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import com.bootcamp.stock.data_provider_app.config.lib.RedisManager;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.dto.LastCandleDto;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.YahooNewsDTO;
import com.bootcamp.stock.data_provider_app.repository.HeatMapRepository;
import com.bootcamp.stock.data_provider_app.repository.StockDataRepository;
import com.bootcamp.stock.data_provider_app.service.ClientService;
import com.bootcamp.stock.data_provider_app.service.StockDataService;

@Service
public class ClientImpl implements ClientService {

  @Autowired
  private StockDataRepository stockDataRepository;

  @Autowired
  private HeatMapRepository heatMapRepository;

  @Autowired
  private RedisManager redisManager;

  @Autowired
  private RestTemplate restTemplate;

  @Autowired
  private HttpEntity<String> httpEntity;

  @Autowired
  private StockDataService stockDataService;

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

  @Override
  public LastCandleDto getLastCandle(String symbol, String interval) {
    return stockDataService.getLastCandle(symbol, interval);
  }

  @Override
  public YahooNewsDTO getYahooNews(String symbol, int newsCount) {
    int safeNewsCount = newsCount > 0 ? newsCount : 10;
    String cacheKey = "yahoo_news_" + symbol + "_" + safeNewsCount;
    YahooNewsDTO cachedNews = redisManager.get(cacheKey, YahooNewsDTO.class);
    if (cachedNews != null) {
      return cachedNews;
    }

    String safeSymbol = URLEncoder.encode(symbol, StandardCharsets.UTF_8);
    String url = String.format(
        "https://query1.finance.yahoo.com/v1/finance/search?q=%s&quotesCount=0&newsCount=%d",
        safeSymbol, safeNewsCount);
    ResponseEntity<YahooNewsDTO> response = restTemplate.exchange(url,
        HttpMethod.GET, httpEntity, YahooNewsDTO.class);
    YahooNewsDTO yahooNewsDTO = response.getBody();
    if (yahooNewsDTO != null) {
      redisManager.set(cacheKey, yahooNewsDTO, Duration.ofSeconds(30));
    }
    return yahooNewsDTO;
  }
}
