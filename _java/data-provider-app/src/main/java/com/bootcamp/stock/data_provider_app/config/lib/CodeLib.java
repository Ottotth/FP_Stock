package com.bootcamp.stock.data_provider_app.config.lib;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.repository.SPListRepository;

@Component
public class CodeLib {

  @Autowired
  private SPListRepository spListRepository;

  public boolean isValidSymbol(String symbol) {
    return spListRepository.existsBySymbol(symbol);
  }

  public ZonedDateTime calculateLatestDateTime(String interval) {
    ZonedDateTime latestDateTime = null;
    if (latestDateTime == null) {
      switch (interval) {
        case "1m":
          latestDateTime = ZonedDateTime.now().minusDays(7);
          break;
        case "5m":
          latestDateTime = ZonedDateTime.now().minusDays(30);
          break;
        case "15m":
          latestDateTime = ZonedDateTime.now().minusDays(90);
          break;
        case "30m":
          latestDateTime = ZonedDateTime.now().minusDays(180);
          break;
        case "1d":
          latestDateTime = ZonedDateTime.now().minusDays(365);
          break;
        case "1wk":
          latestDateTime = ZonedDateTime.now().minusDays(730);
          break;
        case "1mo":
          latestDateTime = ZonedDateTime.now().minusDays(1095);
          break;
        case "3mo":
          latestDateTime = ZonedDateTime.now().minusDays(1825);
          break;
        default:
          System.out.println("Unknown interval: " + interval + ", defaulting to 8 days");
          latestDateTime = ZonedDateTime.now().minusDays(8);
      }
    }
    return latestDateTime;
  }

  public LocalDateTime toBucketStartUtc(long epochSeconds, String interval) {
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

  public String buildLastCandleKey(String symbol, String interval, LocalDateTime bucketStart) {
    return symbol + "|" + interval + "|" + bucketStart;
  }

  public Double maxNullable(Double left, Double right) {
    if (left == null) {
      return right;
    }
    if (right == null) {
      return left;
    }
    return Math.max(left, right);
  }

  public Double minNullable(Double left, Double right) {
    if (left == null) {
      return right;
    }
    if (right == null) {
      return left;
    }
    return Math.min(left, right);
  }

}
