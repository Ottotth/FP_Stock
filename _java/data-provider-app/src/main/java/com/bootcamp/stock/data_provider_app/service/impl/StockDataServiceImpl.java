package com.bootcamp.stock.data_provider_app.service.impl;


import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import org.springframework.web.client.RestTemplate;
import com.bootcamp.stock.data_provider_app.config.lib.CodeLib;
import com.bootcamp.stock.data_provider_app.config.lib.RedisManager;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.dto.LastCandleDto;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.mapper.DtoMapper;
import com.bootcamp.stock.data_provider_app.mapper.EntityMapper;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;
import com.bootcamp.stock.data_provider_app.model.enums.Interval;
import com.bootcamp.stock.data_provider_app.repository.HeatMapRepository;
import com.bootcamp.stock.data_provider_app.repository.OldStockDataRepository;
import com.bootcamp.stock.data_provider_app.repository.SPListRepository;
import com.bootcamp.stock.data_provider_app.repository.StockDataRepository;
import com.bootcamp.stock.data_provider_app.service.StockDataService;

@Service
public class StockDataServiceImpl implements StockDataService {

  // https://query2.finance.yahoo.com/v1/test/getcrumb

  // realtime : https://query1.finance.yahoo.com/v7/finance/quote?symbols=TSLA&crumb=I.d4FnqbyBS

  // chart : https://query1.finance.yahoo.com/v8/finance/chart/AAPL?metrics=high?&interval=1d&range=1mo

  // history : https://query1.finance.yahoo.com/v8/finance/chart/TSLA?period1=1657237004&period2=1752778462&interval=1d&events=history

  @Autowired
  private StockDataRepository stockDataRepository;

  @Autowired
  private OldStockDataRepository oldStockDataRepository;

  @Autowired
  private RestTemplate restTemplate;

  @Autowired
  private EntityManager entityManager;

  @Autowired
  private HttpEntity<String> httpEntity;

  @Autowired
  private EntityMapper entityMapper;

  @Autowired
  private RedisManager redisManager;

  @Autowired
  private DtoMapper dtoMapper;

  @Autowired
  private HeatMapRepository heatMapRepository;

  @Autowired
  private SPListRepository spListRepository;

  @Autowired
  private CodeLib codeLib;

  // Get the stock data by symbol and interval ---------------------------------
  @Override
  public List<StockDataEntity> getBySymbolAndInterval(String symbol,
      String interval) {
    System.out.println("Cache hit for key: " + symbol + "_" + interval);

    StockDataEntity[] cachedData =
        redisManager.get(symbol + "_" + interval, StockDataEntity[].class);
    if (cachedData != null) {
      return Arrays.asList(cachedData);
    }
    List<StockDataEntity> entities =
        stockDataRepository.findBySymbolAndInterval(symbol, interval);
    this.redisManager.set(symbol + "_" + interval,
        entities.toArray(StockDataEntity[]::new), Duration.ofMinutes(5));

    return entities;
  }

  // Update the Stock Chart Data ------------------------------------------------
  @Override
  @Transactional
  public StockChartDTO updateStockChartData(String symbol, String interval) {
    System.out.println("Updating stock chart data for symbol: " + symbol
        + ", interval: " + interval);
    StockDataEntity latestData = stockDataRepository.findTopBySymbolAndIntervalOrderByDateTimeDesc(symbol, interval);
    ZonedDateTime latestDateTime = null;
    // 防止 latestData 為 null 或 getDateTime() 回傳 null 時拋出 NullPointerException
    if (latestData != null && latestData.getDateTime() != null) {
      latestDateTime = latestData.getDateTime().atZone(ZoneId.of("UTC"));
    }
    else {
      // 若無最近時間則退回到預設的往前作為起始時間
      latestDateTime = codeLib.calculateLatestDateTime(interval);
    } 
    System.out.println("Latest DateTime: " + latestDateTime);
    long latestTimestamp = latestDateTime.toEpochSecond();
    ZonedDateTime now = ZonedDateTime.now(ZoneId.of("UTC"));
    System.out.println("Current DateTime: " + now);
    long nowTimestamp = now.toEpochSecond();
    String url = String.format(
        "https://query1.finance.yahoo.com/v8/finance/chart/%s?period1=%d&period2=%d&interval=%s&events=history",
        symbol, latestTimestamp, nowTimestamp, interval);
      System.out.println("Request URL: " + url);
    // 使用注入的 HttpEntity Bean
    ResponseEntity<StockChartDTO> response = restTemplate.exchange(url,
        HttpMethod.GET, httpEntity, StockChartDTO.class);
    StockChartDTO stockChartDTO = response.getBody();

    if (stockChartDTO != null
        && stockChartDTO.getChart() != null
        && stockChartDTO.getChart().getResult() != null
        && !stockChartDTO.getChart().getResult().isEmpty()
        && stockChartDTO.getChart().getResult().get(0) != null
        && stockChartDTO.getChart().getResult().get(0).getTimestamp() == null) {
      return null;
    }

    List<StockDataEntity> newEntities =
      entityMapper.toStockDataEntityList(stockChartDTO, interval);

    if (newEntities != null && !newEntities.isEmpty()) {
      // Collect ids and fetch existing entities in a single query to avoid N+1 selects
      List<Long> ids = newEntities.stream().map(StockDataEntity::getId).collect(Collectors.toList());
      List<StockDataEntity> existing = stockDataRepository.findAllById(ids);
      // Map existing by id for quick lookup
      Map<Long, StockDataEntity> existingMap = existing.stream()
          .collect(Collectors.toMap(StockDataEntity::getId, e -> e));

      List<StockDataEntity> toUpdate = new java.util.ArrayList<>();

      for (StockDataEntity e : newEntities) {
        StockDataEntity exist = existingMap.get(e.getId());
        if (exist != null) {
          // update managed entity fields
          exist.setOpen(e.getOpen());
          exist.setHigh(e.getHigh());
          exist.setLow(e.getLow());
          exist.setClose(e.getClose());
          exist.setVolume(e.getVolume());
          exist.setAdjClose(e.getAdjClose());
          exist.setDateTime(e.getDateTime());
          toUpdate.add(exist);
        } else {
          // new entity: persist directly to avoid merge select
          entityManager.persist(e);
        }
      }

      if (!toUpdate.isEmpty()) {
        stockDataRepository.saveAll(toUpdate);
      }
      System.out.println("----------save---------");
    }

    return stockChartDTO;
  }

  // Real-time stock data ------------------------------------------------------
  @Override
  public RealTimeSTockDTO getRealTimeStockData(String symbol) {
    String url = String.format(
        "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%s&crumb=I.d4FnqbyBS",
        symbol);
    ResponseEntity<RealTimeSTockDTO> response = restTemplate.exchange(url,
        HttpMethod.GET, httpEntity, RealTimeSTockDTO.class);
    return response.getBody();
  }

  // Update the Old Data to other table ----------------------------------------
  @Override
  public List<OldStockDataEntity> getOldStockData(String symbol,
      String interval, int days) {
    List<StockDataEntity> oldData =
        stockDataRepository.findOldDataEntity(symbol, interval, days);
    List<OldStockDataEntity> oldStockDataEntities =
        oldData.stream().map(data -> entityMapper.toOldStockDataEntity(data))
            .collect(Collectors.toList());
    oldStockDataRepository.saveAll(oldStockDataEntities);
    stockDataRepository.deleteOldDataEntity(symbol, interval, days);

    return oldStockDataEntities;
  }

  // Update the heat map data from DB------------------------------------------------------
  @Override
  public HeatMapDto updateHeatMapData() {
    List<String> symbols = getAllSymbols();
    String symbolsStr = String.join(",", symbols);
    RealTimeSTockDTO realTimeStockDTO = getRealTimeStockData(symbolsStr);
    HeatMapDto heatMapDto = dtoMapper.mapRealTimeStockDataToHeatMapDto(realTimeStockDTO);
    heatMapRepository.saveAll(heatMapDto.getHeatMapData());
    updateLastCandlesFromRealtime(realTimeStockDTO);
    return heatMapDto;
  }

  // Get all symbols from DB------------------------------------------------------
  @Override
  public List<String> getAllSymbols() {
    return spListRepository.findAllSymbols();
  }

  // Last candle -------------------------------------------------------
  @Override
  public LastCandleDto getLastCandle(String symbol, String interval) {
    String redisKey = "lastcandle:" + symbol + ":" + interval;
    LastCandleDto dto = redisManager.get(redisKey, LastCandleDto.class);
    return dto;
  }

  private void updateLastCandlesFromRealtime(RealTimeSTockDTO dto) {
    List<RealTimeSTockDTO.Result> results = dto != null
        && dto.getQuoteResponse() != null
        ? dto.getQuoteResponse().getResult()
        : null;
    if (results == null || results.isEmpty()) {
      return;
    }

    LocalDateTime updatedAt = LocalDateTime.now(ZoneId.of("UTC"));
    Map<String, LastCandleDto> aggregated = new HashMap<>();

    for (RealTimeSTockDTO.Result quote : results) {
      String symbol = quote.getSymbol();
      Double latestPrice = quote.getRegularMarketPrice() != null
          ? quote.getRegularMarketPrice()
          : quote.getPostMarketPrice();
      Long marketTimeEpoch = quote.getRegularMarketTime() != null
          ? quote.getRegularMarketTime()
          : quote.getPostMarketTime();

      if (symbol == null || symbol.isBlank() || latestPrice == null
          || !Double.isFinite(latestPrice) || marketTimeEpoch == null
          || marketTimeEpoch <= 0) {
        continue;
      }

      for (Interval interval : Interval.values()) {
        // only intervals that support last-candle should be updated here
        if (!interval.supportsLastCandle()) {
          continue;
        }
        String intervalValue = interval.getValue();
        LocalDateTime bucketStart = codeLib.toBucketStartUtc(marketTimeEpoch, intervalValue);
        String key = codeLib.buildLastCandleKey(symbol, intervalValue, bucketStart);
        LastCandleDto row = aggregated.get(key);
        if (row == null) {
          aggregated.put(key, LastCandleDto.builder()
              .symbol(symbol)
              .interval(intervalValue)
              .bucketStart(bucketStart)
              .open(latestPrice)
              .high(latestPrice)
              .low(latestPrice)
              .close(latestPrice)
              .updatedAt(updatedAt)
              .build());
          continue;
        }

        row.setHigh(codeLib.maxNullable(row.getHigh(), latestPrice));
        row.setLow(codeLib.minNullable(row.getLow(), latestPrice));
        row.setClose(latestPrice);
        row.setUpdatedAt(updatedAt);
      }
    }

    if (aggregated.isEmpty()) {
      return;
    }

    // Write aggregated last-candle to Redis (overwrite per symbol+interval)
    // TTL: 24 hours (adjust as needed)
    Duration ttl = Duration.ofHours(24);
    for (LastCandleDto row : aggregated.values()) {
      String redisKey = "lastcandle:" + row.getSymbol() + ":" + row.getInterval();
      // Read existing value and merge when bucketStart matches to preserve open/high/low
      try {
        LastCandleDto existing = this.redisManager.get(redisKey, LastCandleDto.class);
        if (existing != null && existing.getBucketStart() != null && existing.getBucketStart().equals(row.getBucketStart())) {
          // preserve the original open (first price in the bucket) if present
          row.setOpen(existing.getOpen() != null ? existing.getOpen() : row.getOpen());
          // merge high/low
          row.setHigh(codeLib.maxNullable(existing.getHigh(), row.getHigh()));
          row.setLow(codeLib.minNullable(existing.getLow(), row.getLow()));
          // close should be the latest price (row.getClose())
          row.setUpdatedAt(updatedAt);
        }
      } catch (Exception ex) {
        // if any error occurs reading/merging, fall back to writing the new row
        System.out.println("Warning: failed to merge existing lastcandle for key=" + redisKey + ", error=" + ex.getMessage());
      }

      this.redisManager.set(redisKey, row, ttl);
    }
  }

  

  

  

  

  

  
}


