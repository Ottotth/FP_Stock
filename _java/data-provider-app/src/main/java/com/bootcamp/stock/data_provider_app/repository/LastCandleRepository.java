package com.bootcamp.stock.data_provider_app.repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.bootcamp.stock.data_provider_app.entity.LastCandleEntity;

public interface LastCandleRepository extends JpaRepository<LastCandleEntity, Long> {

  Optional<LastCandleEntity> findBySymbolAndIntervalAndBucketStart(
      String symbol, String interval, LocalDateTime bucketStart);

  Optional<LastCandleEntity> findTopBySymbolAndIntervalOrderByBucketStartDesc(
      String symbol, String interval);

  List<LastCandleEntity> findBySymbolInAndIntervalInAndBucketStartIn(
      Collection<String> symbols,
      Collection<String> intervals,
      Collection<LocalDateTime> bucketStarts);
}
