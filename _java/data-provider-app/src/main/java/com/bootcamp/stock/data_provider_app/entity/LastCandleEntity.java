package com.bootcamp.stock.data_provider_app.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "last_candle")
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LastCandleEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private int id;
  private String symbol;
  private String interval;
  private Double open;
  private Double high;
  private Double low;
  private Double close;
  
}
