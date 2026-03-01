package com.bootcamp.stock.data_provider_app.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Entity
@Table(name = "heatmapdata")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class HeatMapEntity {
  @Id
  @Column (unique = true , nullable = false)
  private String symbol;

  private double currentPrice;

  private double priceChange;

  private double changePercent;

  private long volume;

  private String gicsSector;

  private String security;

  private Long marketCap;
  
  private double regularMarketDayHigh;
  
  private double regularMarketDayLow;
}
