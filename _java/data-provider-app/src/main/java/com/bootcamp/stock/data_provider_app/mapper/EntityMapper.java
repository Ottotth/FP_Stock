package com.bootcamp.stock.data_provider_app.mapper;
import java.math.BigInteger;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
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
    String interval = stockDataDTO.getChart().getResult().get(0).getMeta().getDataGranularity();
    return toStockDataEntityList(stockDataDTO, interval);
  }

  public List<StockDataEntity> toStockDataEntityList(StockChartDTO stockDataDTO,
      String requestedInterval) {
    // 用 LinkedHashMap 保留輸入順序，key 為 (dateTime+symbol+interval) 生成的 id。
    // 同一個 bucket 若重複出現（例如 1mo 最後一筆是即時時間），會走合併而不是新增。
    Map<Long, StockDataEntity> entitiesById = new LinkedHashMap<>();
    StockChartDTO.Result result = stockDataDTO.getChart().getResult().get(0);
    List<Long> timestamps = result.getTimestamp();
    StockChartDTO.Quote quote = result.getIndicators().getQuote().get(0);
    List<Double> adjCloses = null;
    if (result.getIndicators().getAdjclose() != null && !result.getIndicators().getAdjclose().isEmpty()) {
      adjCloses = result.getIndicators().getAdjclose().get(0).getAdjclose();
    }
    for (int i = 0; i < timestamps.size(); i++) {
      String symbol = result.getMeta().getSymbol();
      String interval = requestedInterval;
      
      LocalDateTime dateTime = Instant.ofEpochSecond(timestamps.get(i))
          .atZone(ZoneId.of("UTC"))
          .toLocalDateTime();

        // 關鍵：所有 interval 一律先做 UTC bucket 對齊，避免供應商最後一筆時間格式不一致。
      dateTime = normalizeBucketUtc(dateTime, interval);
      
      // 格式化為 "yyyy-MM-dd HH:mm:ss" 以匹配 Python 的 str(datetime) 格式
      DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
      String dateTimeStr = dateTime.format(formatter);
      
      // 生成 ID - 基於 DateTime、Symbol、Interval 的 hash
      long id = generateHashId(dateTimeStr, symbol, interval);

      // 先查該 bucket 是否已存在
      StockDataEntity existing = entitiesById.get(id);
      if (existing == null) {
        // 新 bucket：建立新 K 棒
        StockDataEntity entity = new StockDataEntity();
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
        entitiesById.put(id, entity);
      } else {
        // 同 bucket 合併規則：
        // open 保留第一筆（不改）、high 取最大、low 取最小、close/volume/adjClose 用最新值
        existing.setHigh(maxNullable(existing.getHigh(), quote.getHigh().get(i)));
        existing.setLow(minNullable(existing.getLow(), quote.getLow().get(i)));
        existing.setClose(quote.getClose().get(i));
        existing.setVolume(quote.getVolume().get(i));
        if (adjCloses != null && i < adjCloses.size()) {
          existing.setAdjClose(adjCloses.get(i));
        }
      }
    }
    return new ArrayList<>(entitiesById.values());
  }

  private LocalDateTime normalizeBucketUtc(LocalDateTime dateTime, String interval) {
    if (interval == null) {
      return dateTime;
    }
    // 所有分桶規則都以 UTC 為準，回傳標準 bucket 起點。
    switch (interval.toLowerCase()) {
      case "3mo":
        // 季線：對齊到當季第一個月的 1 號 00:00 UTC
        int quarterStartMonth = ((dateTime.getMonthValue() - 1) / 3) * 3 + 1;
        return dateTime.withMonth(quarterStartMonth).withDayOfMonth(1)
            .truncatedTo(ChronoUnit.DAYS);
      case "1mo":
        // 月線：對齊到該月 1 號 00:00 UTC
        return dateTime.withDayOfMonth(1).truncatedTo(ChronoUnit.DAYS);
      case "1wk":
      case "1w":
        // 週線：對齊到該週週一 00:00 UTC
        return dateTime.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
            .truncatedTo(ChronoUnit.DAYS);
      case "5d":
      case "1d":
        // 日線：對齊到當天 00:00 UTC
        return dateTime.truncatedTo(ChronoUnit.DAYS);
      case "4h":
        // 4h：小時向下取整到 4 的倍數
        return dateTime.withMinute(0).withSecond(0).withNano(0)
            .withHour((dateTime.getHour() / 4) * 4);
      case "1h":
      case "60m":
        // 1h：分秒歸零
        return dateTime.withMinute(0).withSecond(0).withNano(0);
      case "30m":
        // 30m：分鐘向下取整到 30 的倍數
        return dateTime.withSecond(0).withNano(0)
            .withMinute((dateTime.getMinute() / 30) * 30);
      case "15m":
        // 15m：分鐘向下取整到 15 的倍數
        return dateTime.withSecond(0).withNano(0)
            .withMinute((dateTime.getMinute() / 15) * 15);
      case "5m":
        // 5m：分鐘向下取整到 5 的倍數
        return dateTime.withSecond(0).withNano(0)
            .withMinute((dateTime.getMinute() / 5) * 5);
      case "1m":
        // 1m：秒與奈秒歸零
        return dateTime.withSecond(0).withNano(0);
      default:
        // 未定義 interval：保留原始 UTC 時間
        return dateTime;
    }
  }

  private Double maxNullable(Double current, Double next) {
    if (current == null) {
      return next;
    }
    if (next == null) {
      return current;
    }
    return Math.max(current, next);
  }

  private Double minNullable(Double current, Double next) {
    if (current == null) {
      return next;
    }
    if (next == null) {
      return current;
    }
    return Math.min(current, next);
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
  
}
