package com.bootcamp.stock.data_provider_app.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "sp500_list")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SPListEntity {
  @Id
  @Column(name = "symbol", nullable = false, unique = true , length = 24)
  private String symbol;

  @Column(name = "security", nullable = false, length = 128)
  private String security;

  @Column(name = "gics_sector", nullable = false, length = 64)
  private String gicsSector;

  @Column(name = "headquarters_location", length = 128)
  private String headquartersLocation;


}
