package com.bootcamp.stock.data_provider_app.mapper;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import com.bootcamp.stock.data_provider_app.model.dto.RealTimeSTockDTO;
import com.bootcamp.stock.data_provider_app.model.dto.StockChartDTO;

@Component
public class EntityMapper {

  // 生成 ID 的方法 - 和 Python 中相同的邏輯
  private long generateHashId(String dateTime, String symbol, String interval) {
    try {
      // 組合字串：datetime_str_symbol_interval
      String combined = dateTime + "_" + symbol + "_" + interval;
      
      // SHA256 hash
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(combined.getBytes());
      
      // 轉換為 16 進制字串（整個 hash，64 個字符）
      StringBuilder hexString = new StringBuilder();
      for (byte b : hash) {
        String hex = Integer.toHexString(0xff & b);
        if (hex.length() == 1) hexString.append('0');
        hexString.append(hex);
      }
      
      // 轉換為 BigInteger（模仿 Python 的 int(hexdigest, 16)）
      BigInteger hashInt = new BigInteger(hexString.toString(), 16);
      
      // 模 2^63（Python 的 % (2**63)）
      BigInteger mod = BigInteger.valueOf(2).pow(63);
      long result = hashInt.mod(mod).longValue();
      
      return result;
    } catch (Exception e) {
      throw new RuntimeException("生成 Hash ID 失敗", e);
    }
  }

  public List<StockDataEntity> toStockDataEntityList(StockChartDTO stockDataDTO) {
    List<StockDataEntity> entities = new ArrayList<>();
    StockChartDTO.Result result = stockDataDTO.getChart().getResult().get(0);
    List<Long> timestamps = result.getTimestamp();
    StockChartDTO.Quote quote = result.getIndicators().getQuote().get(0);
    List<Double> adjCloses = null;
    if (result.getIndicators().getAdjclose() != null && !result.getIndicators().getAdjclose().isEmpty()) {
      adjCloses = result.getIndicators().getAdjclose().get(0).getAdjclose();
    }
    for (int i = 0; i < timestamps.size(); i++) {
      StockDataEntity entity = new StockDataEntity();
      String symbol = result.getMeta().getSymbol();
      String interval = result.getMeta().getDataGranularity();
      
      LocalDateTime dateTime = Instant.ofEpochSecond(timestamps.get(i))
          .atZone(ZoneId.of("UTC"))
          .toLocalDateTime();
          
      // 只有日/週/月區間才歸零時間，日內保留完整時間以避免 ID 重複
      if (isDailyOrAbove(interval)) {
        dateTime = dateTime.withHour(0).withMinute(0).withSecond(0).withNano(0);
      }
      
      // 格式化為 "yyyy-MM-dd HH:mm:ss" 以匹配 Python 的 str(datetime) 格式
      DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
      String dateTimeStr = dateTime.format(formatter);
      
      // 生成 ID - 基於 DateTime、Symbol、Interval 的 hash
      long id = generateHashId(dateTimeStr, symbol, interval);
      
      entity.setId(id);
      entity.setSymbol(symbol);
      entity.setInterval(interval);
      entity.setDateTime(dateTime);
      entity.setOpen(quote.getOpen().get(i));
      entity.setHigh(quote.getHigh().get(i));
      entity.setLow(quote.getLow().get(i));
      entity.setClose(quote.getClose().get(i));
      entity.setVolume(quote.getVolume().get(i));
      if (adjCloses != null && i < adjCloses.size()) {
        entity.setAdjClose(adjCloses.get(i));
      }
      entities.add(entity);
    }
    return entities;
  }

  private boolean isDailyOrAbove(String interval) {
    return "1d".equalsIgnoreCase(interval)
        || "5d".equalsIgnoreCase(interval)
        || "1wk".equalsIgnoreCase(interval)
        || "1mo".equalsIgnoreCase(interval)
        || "3mo".equalsIgnoreCase(interval);
  }

  public OldStockDataEntity toOldStockDataEntity(StockDataEntity stockDataEntity) {
    return OldStockDataEntity.builder()
        .id(stockDataEntity.getId())
        .symbol(stockDataEntity.getSymbol())
        .interval(stockDataEntity.getInterval())
        .dateTime(stockDataEntity.getDateTime())
        .open(stockDataEntity.getOpen())
        .high(stockDataEntity.getHigh())
        .low(stockDataEntity.getLow())
        .close(stockDataEntity.getClose())
        .volume(stockDataEntity.getVolume())
        .adjClose(stockDataEntity.getAdjClose())
        .build();
  }

  public HeatMapEntity toHeatMapEntity(RealTimeSTockDTO realTimeStockDTO) {
    return HeatMapEntity.builder()
        .symbol(realTimeStockDTO.getQuoteResponse().getResult().get(0).getSymbol())
        .currentPrice(realTimeStockDTO.getQuoteResponse().getResult().get(0).getRegularMarketPrice())
        .changePercent(realTimeStockDTO.getQuoteResponse().getResult().get(0).getRegularMarketChangePercent())
        .volume(realTimeStockDTO.getQuoteResponse().getResult().get(0).getRegularMarketVolume())
        .build();
  }
  
}
