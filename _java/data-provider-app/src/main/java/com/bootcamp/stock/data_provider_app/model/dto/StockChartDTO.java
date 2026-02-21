package com.bootcamp.stock.data_provider_app.model.dto;


import java.util.List;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StockChartDTO {
  private Chart chart;

  @Data
  public static class Chart {
    private List<Result> result;
    private String error;
  }

  @Data
  public static class Result {
    private Meta meta;
    @JsonProperty("timestamp")
    private List<Long> timestamp;
    private Indicators indicators;
  }

  @Data
  public static class Meta {
    private String currency;
    private String symbol;
    private String exchangeName;
    private String fullExchangeName;
    private String instrumentType;
    private Long firstTradeDate;
    private Long regularMarketTime;
    private Boolean hasPrePostMarketData;
    private Integer gmtoffset;
    private String timezone;
    private String exchangeTimezoneName;
    private Double regularMarketPrice;
    private Double fiftyTwoWeekHigh;
    private Double fiftyTwoWeekLow;
    private Double regularMarketDayHigh;
    private Double regularMarketDayLow;
    private Long regularMarketVolume;
    private String longName;
    private String shortName;
    private Double chartPreviousClose;
    private Integer priceHint;
    private CurrentTradingPeriod currentTradingPeriod;
    private String dataGranularity;
    private String range;
    private List<String> validRanges;
  }

  @Data
  public static class CurrentTradingPeriod {
    private TradingPeriod pre;
    private TradingPeriod regular;
    private TradingPeriod post;
  }

  @Data
  public static class TradingPeriod {
    private String timezone;
    private Long start;
    private Long end;
    private Integer gmtoffset;
  }

  @Data
  public static class Indicators {
    private List<Quote> quote;
    private List<AdjClose> adjclose;
  }

  @Data
  public static class Quote {
    private List<Double> high;
    private List<Double> low;
    private List<Double> close;
    private List<Long> volume;
    private List<Double> open;
  }

  @Data
  public static class AdjClose {
    private List<Double> adjclose;
  }
}
