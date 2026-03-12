package com.bootcamp.stock.data_provider_app.model.enums;

public enum Interval {
  ONE_MINUTE("1m", true),
  FIVE_MINUTES("5m", true),
  FIFTEEN_MINUTES("15m", true),
  THIRTY_MINUTES("30m", true),
  ONE_HOUR("1h", true),
  FOUR_HOURS("4h", true),
  ONE_DAY("1d", true),
  ONE_WEEK("1wk", false),
  ONE_MONTH("1mo", false),
  THREE_MONTHS("3mo", false);

  private final String value;
  private final boolean supportsLastCandle;

  Interval(String value, boolean supportsLastCandle) {
    this.value = value;
    this.supportsLastCandle = supportsLastCandle;
  }

  public String getValue() {
    return value;
  }

  /**
   * 是否使用 last-candle 機制（儲存在 Redis），
   * 若為 false 則應從資料庫 `stockdata` 表組合 candle map。
   */
  public boolean supportsLastCandle() {
    return supportsLastCandle;
  }
}