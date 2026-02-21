package com.bootcamp.stock.data_provider_app.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.bootcamp.stock.data_provider_app.entity.OldStockDataEntity;

public interface OldStockDataRepository extends JpaRepository<OldStockDataEntity, Long> {
  
}
