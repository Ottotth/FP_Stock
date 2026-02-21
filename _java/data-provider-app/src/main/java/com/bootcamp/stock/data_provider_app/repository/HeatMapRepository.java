package com.bootcamp.stock.data_provider_app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.bootcamp.stock.data_provider_app.entity.HeatMapEntity;

@Repository
public interface HeatMapRepository extends JpaRepository<HeatMapEntity, String> {
  
}
