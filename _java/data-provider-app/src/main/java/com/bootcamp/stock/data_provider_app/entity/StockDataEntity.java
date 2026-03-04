package com.bootcamp.stock.data_provider_app.entity;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "stockdata") 
@Getter
@Setter
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class StockDataEntity {
  @Id
  @Column(name = "id" ,nullable = false, unique = true , length = 64)
  private Long id;

  @Column(name = "symbol" , nullable = false , length = 8)
  private String symbol;

  @Column(name = "interval", length = 4)
  private String interval;

  @Column(name = "date_time")
  private LocalDateTime dateTime;
  
  @Column(name = "open_price")
  private Double open;
  
  @Column(name = "high_price")
  private Double high;
  
  @Column(name = "low_price")
  private Double low;
  
  @Column(name = "close_price")
  private Double close;
  
  @Column(name = "volume")
  private Long volume;
  
  @Column(name = "adj_close")
  private Double adjClose;

}
