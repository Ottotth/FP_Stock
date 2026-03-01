package com.bootcamp.stock.data_provider_app.dto;

import java.util.List;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class HeatMapDto {
  private List<HeatMapEntity> heatMapData;
}
