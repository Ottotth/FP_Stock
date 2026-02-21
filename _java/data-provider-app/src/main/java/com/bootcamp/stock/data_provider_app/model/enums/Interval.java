package com.bootcamp.stock.data_provider_app.model.enums;

public enum Interval {
  ONE_MINUTE("1m"),
  FIVE_MINUTES("5m"),
  FIFTEEN_MINUTES("15m"),
  THIRTY_MINUTES("30m"),
  ONE_HOUR("1h"),
  FOUR_HOURS("4h"),
  ONE_DAY("1d"),
  ONE_WEEK("1w"),
  ONE_MONTH("1mo"),
  THREE_MONTHS("3mo");

  private final String value;

  Interval(String value) {
    this.value = value;
  }

  public String getValue() {
    return value;
  }
}