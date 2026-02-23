package com.bootcamp.stock.data_provider_app.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import com.bootcamp.stock.data_provider_app.entity.SPListEntity;

@Repository
public interface SPListRepository extends JpaRepository<SPListEntity, String> {

  @Query("SELECT s.symbol FROM SPListEntity s")
  List<String> findAllSymbols();

  @Query("SELECT s.gicsSector FROM SPListEntity s WHERE s.symbol = :symbol")
  String findGicsSectorBySymbol(String symbol);
}
