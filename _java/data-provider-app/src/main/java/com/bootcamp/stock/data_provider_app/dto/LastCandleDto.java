package com.bootcamp.stock.data_provider_app.dto;

import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Setter
@Getter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class LastCandleDto {

  private String symbol;
  private String interval;
  private LocalDateTime bucketStart;
  private Double open;
  private Double high;
  private Double low;
  private Double close;
  private LocalDateTime updatedAt;
  
}
