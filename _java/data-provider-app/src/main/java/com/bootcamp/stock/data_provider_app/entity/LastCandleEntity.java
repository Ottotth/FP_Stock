package com.bootcamp.stock.data_provider_app.entity;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "last_candle",
  uniqueConstraints = {
    @UniqueConstraint(name = "uk_last_candle_symbol_interval_bucket",
      columnNames = {"symbol", "interval", "bucket_start"})
  },
  indexes = {
    @Index(name = "idx_last_candle_symbol_interval_bucket",
      columnList = "symbol, interval, bucket_start"),
    @Index(name = "idx_last_candle_symbol_interval",
      columnList = "symbol, interval")
  })
@Setter
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LastCandleEntity {
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  private Long id;

  @Column(name = "symbol", nullable = false)
  private String symbol;

  @Column(name = "interval", nullable = false)
  private String interval;

  @Column(name = "bucket_start", nullable = false)
  private LocalDateTime bucketStart;

  @Column(name = "open_price")
  private Double open;

  @Column(name = "high_price")
  private Double high;

  @Column(name = "low_price")
  private Double low;

  @Column(name = "close_price")
  private Double close;

  @Column(name = "updated_at")
  private LocalDateTime updatedAt;
  
}
