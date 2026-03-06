package com.bootcamp.stock.data_provider_app.service.impl;


import java.time.Duration;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.Collection;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestTemplate;
import com.bootcamp.stock.data_provider_app.config.lib.CodeLib;
import com.bootcamp.stock.data_provider_app.config.lib.RedisManager;
import com.bootcamp.stock.data_provider_app.dto.HeatMapDto;
import com.bootcamp.stock.data_provider_app.entity.LastCandleEntity;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.mapper.DtoMapper;
import com.bootcamp.stock.data_provider_app.mapper.EntityMapper;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;
import com.bootcamp.stock.data_provider_app.model.enums.Interval;
import com.bootcamp.stock.data_provider_app.repository.HeatMapRepository;
import com.bootcamp.stock.data_provider_app.repository.LastCandleRepository;
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
  private LastCandleRepository lastCandleRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

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

  @Override
  public LastCandleEntity getLastCandle(String symbol, String interval) {
    return lastCandleRepository
        .findTopBySymbolAndIntervalOrderByBucketStartDesc(symbol, interval)
        .orElse(null);
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
    Map<String, LastCandleUpsertRow> aggregated = new HashMap<>();

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
        String intervalValue = interval.getValue();
        LocalDateTime bucketStart = toBucketStartUtc(marketTimeEpoch, intervalValue);
        String key = buildLastCandleKey(symbol, intervalValue, bucketStart);
        LastCandleUpsertRow row = aggregated.get(key);
        if (row == null) {
          aggregated.put(key, new LastCandleUpsertRow(symbol, intervalValue,
              bucketStart, latestPrice, latestPrice, latestPrice, latestPrice,
              updatedAt));
          continue;
        }

        row.high = maxNullable(row.high, latestPrice);
        row.low = minNullable(row.low, latestPrice);
        row.close = latestPrice;
        row.updatedAt = updatedAt;
      }
    }

    if (aggregated.isEmpty()) {
      return;
    }

    batchUpsertLastCandles(aggregated.values());
  }

  private void batchUpsertLastCandles(Collection<LastCandleUpsertRow> rows) {
    if (rows == null || rows.isEmpty()) {
      return;
    }

    String sql = "INSERT INTO last_candle "
        + "(symbol, interval, bucket_start, open_price, high_price, low_price, close_price, updated_at) "
        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
        + "ON CONFLICT (symbol, interval, bucket_start) DO UPDATE SET "
        + "open_price = COALESCE(last_candle.open_price, EXCLUDED.open_price), "
        + "high_price = GREATEST(COALESCE(last_candle.high_price, EXCLUDED.high_price), EXCLUDED.high_price), "
        + "low_price = LEAST(COALESCE(last_candle.low_price, EXCLUDED.low_price), EXCLUDED.low_price), "
        + "close_price = EXCLUDED.close_price, "
        + "updated_at = EXCLUDED.updated_at";

    List<LastCandleUpsertRow> batch = rows.stream().collect(Collectors.toList());
    jdbcTemplate.batchUpdate(sql, batch, batch.size(), (ps, row) -> {
      ps.setString(1, row.symbol);
      ps.setString(2, row.interval);
      ps.setObject(3, row.bucketStart);
      ps.setObject(4, row.open);
      ps.setObject(5, row.high);
      ps.setObject(6, row.low);
      ps.setObject(7, row.close);
      ps.setObject(8, row.updatedAt);
    });
  }

  private String buildLastCandleKey(String symbol, String interval,
      LocalDateTime bucketStart) {
    return symbol + "|" + interval + "|" + bucketStart;
  }

  private static class LastCandleUpsertRow {
    private final String symbol;
    private final String interval;
    private final LocalDateTime bucketStart;
    private Double open;
    private Double high;
    private Double low;
    private Double close;
    private LocalDateTime updatedAt;

    private LastCandleUpsertRow(String symbol, String interval,
        LocalDateTime bucketStart, Double open, Double high, Double low,
        Double close, LocalDateTime updatedAt) {
      this.symbol = symbol;
      this.interval = interval;
      this.bucketStart = bucketStart;
      this.open = open;
      this.high = high;
      this.low = low;
      this.close = close;
      this.updatedAt = updatedAt;
    }
  }

  private LocalDateTime toBucketStartUtc(long epochSeconds, String interval) {
    ZonedDateTime utc = Instant.ofEpochSecond(epochSeconds).atZone(ZoneId.of("UTC"));
    switch (interval) {
      case "1m":
        return utc.withSecond(0).withNano(0).toLocalDateTime();
      case "5m":
        return utc.withMinute((utc.getMinute() / 5) * 5)
            .withSecond(0).withNano(0).toLocalDateTime();
      case "15m":
        return utc.withMinute((utc.getMinute() / 15) * 15)
            .withSecond(0).withNano(0).toLocalDateTime();
      case "30m":
        return utc.withMinute((utc.getMinute() / 30) * 30)
            .withSecond(0).withNano(0).toLocalDateTime();
      case "1h":
        return utc.withMinute(0).withSecond(0).withNano(0).toLocalDateTime();
      case "4h":
        return utc.withHour((utc.getHour() / 4) * 4)
            .withMinute(0).withSecond(0).withNano(0).toLocalDateTime();
      case "1wk":
        ZonedDateTime weekStart = utc.with(DayOfWeek.MONDAY)
            .withHour(0).withMinute(0).withSecond(0).withNano(0);
        return weekStart.toLocalDateTime();
      case "1mo":
        return utc.withDayOfMonth(1).withHour(0).withMinute(0)
            .withSecond(0).withNano(0).toLocalDateTime();
      case "3mo":
        int quarterStartMonth = ((utc.getMonthValue() - 1) / 3) * 3 + 1;
        return utc.withMonth(quarterStartMonth).withDayOfMonth(1)
            .withHour(0).withMinute(0).withSecond(0).withNano(0)
            .toLocalDateTime();
      case "1d":
      default:
        return utc.withHour(0).withMinute(0).withSecond(0).withNano(0).toLocalDateTime();
    }
  }

  private Double maxNullable(Double left, Double right) {
    if (left == null) {
      return right;
    }
    if (right == null) {
      return left;
    }
    return Math.max(left, right);
  }

  private Double minNullable(Double left, Double right) {
    if (left == null) {
      return right;
    }
    if (right == null) {
      return left;
    }
    return Math.min(left, right);
  }
}


