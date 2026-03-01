package com.bootcamp.stock.data_provider_app.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import com.bootcamp.stock.data_provider_app.entity.StockDataEntity;
import jakarta.transaction.Transactional;

@Repository
public interface StockDataRepository extends JpaRepository<StockDataEntity, Long> {

  @Query("SELECT s FROM StockDataEntity s WHERE s.symbol = :symbol AND s.interval = :interval")
  List<StockDataEntity> findBySymbolAndInterval(String symbol, String interval);

  // Find latest 30 records for the symbol/interval (case-insensitive).
  // Avoid filtering by current date, otherwise historical snapshots may return empty.
  @Query(value = "SELECT * FROM stockdata s WHERE UPPER(s.symbol) = UPPER(:symbol) AND LOWER(s.interval) = LOWER(:interval) ORDER BY s.date_time DESC LIMIT 30", nativeQuery = true)
  List<StockDataEntity> findRecent30DataEntity(String symbol, String interval);

  // Use Spring Data derived query to get the newest entity.
  // JPQL does not support LIMIT; use "findTopBy...OrderBy...Desc" instead.
  StockDataEntity findTopBySymbolAndIntervalOrderByDateTimeDesc(String symbol, String interval);

  // Select the Entity before N day ago
  @Query(value = "SELECT * FROM stockdata s WHERE s.symbol = :symbol AND s.interval = :interval AND s.date_time < (CURRENT_DATE - make_interval(days => :days)) ORDER BY s.date_time DESC", nativeQuery = true)
  List<StockDataEntity> findOldDataEntity(String symbol, String interval, int days);
  
  // Delete the data before N day ago
  @Transactional
  @Modifying
  @Query(value = "DELETE FROM stockdata s WHERE s.symbol = :symbol AND s.interval = :interval AND s.date_time < (CURRENT_DATE - make_interval(days => :days))", nativeQuery = true )
  void deleteOldDataEntity(String symbol, String interval, int days);
  
} 
