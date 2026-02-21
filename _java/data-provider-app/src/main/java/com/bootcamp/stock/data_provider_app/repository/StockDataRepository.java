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

  @Query("SELECT s FROM StockDataEntity s WHERE s.symbol = :symbol AND s.interval = :interval ORDER BY s.dateTime DESC LIMIT 1")
  StockDataEntity findNewestDataEntity(String symbol, String interval);

  // Select the Entity before N day ago
  @Query(value = "SELECT * FROM stockdata s WHERE s.symbol = :symbol AND s.interval = :interval AND s.date_time < (CURRENT_DATE - make_interval(days => :days)) ORDER BY s.date_time DESC", nativeQuery = true)
  List<StockDataEntity> findOldDataEntity(String symbol, String interval, int days);
  
  // Delele the data before N day ago
  @Transactional
  @Modifying
  @Query(value = "DELETE FROM stockdata s WHERE s.symbol = :symbol AND s.interval = :interval AND s.date_time < (CURRENT_DATE - make_interval(days => :days))", nativeQuery = true )
  void deleteOldDataEntity(String symbol, String interval, int days);
  
} 
//   @Autowired
//   private JdbcTemplate jdbcTemplate;

//   // 根據股票代碼和時間間隔查詢股票資料
//   public List<StockDataEntity> findBySymbolAndInterval(String symbol, String interval) {
//     String sql = "SELECT \"id\", \"Symbol\" as symbol, \"Interval\" as interval, " +
//                  "\"DateTime\" as dateTime, \"Open\" as open, \"High\" as high, " +
//                  "\"Low\" as low, \"Close\" as close, \"Volume\" as volume, " +
//                  "\"AdjClose\" as adjClose FROM stockdata " +
//                  "WHERE \"Symbol\" = ? AND \"Interval\" = ?";
    
//     return jdbcTemplate.query(sql, new BeanPropertyRowMapper<>(StockDataEntity.class), 
//                               symbol, interval);
//   }
  
//   public StockDataEntity findNewDataEntity(String symbol, String interval) {
//     String sql = "SELECT \"id\", \"Symbol\" as symbol, \"Interval\" as interval, " +
//                  "\"DateTime\" as dateTime, \"Open\" as open, \"High\" as high, " +
//                  "\"Low\" as low, \"Close\" as close, \"Volume\" as volume, " +
//                  "\"AdjClose\" as adjClose FROM stockdata " +
//                  "WHERE \"Symbol\" = ? AND \"Interval\" = ? ORDER BY \"DateTime\" DESC LIMIT 1";
    
//     return jdbcTemplate.queryForObject(sql, new BeanPropertyRowMapper<>(StockDataEntity.class), 
//                               symbol, interval);
//   }

//   // 批次寫入股票資料
//   public void saveAll(List<StockDataEntity> entities) {
//     if (entities == null || entities.isEmpty()) {
//       return;
//     }

//     String sql = "INSERT INTO stockdata (\"id\", \"Symbol\", \"Interval\", \"DateTime\", \"Open\", \"High\", \"Low\", \"Close\", \"AdjClose\", \"Volume\") "
//         + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
//         + "ON CONFLICT (\"id\") DO NOTHING";

//     jdbcTemplate.batchUpdate(sql, entities, 1000,
//         (ParameterizedPreparedStatementSetter<StockDataEntity>) (ps, entity) -> {
//           ps.setLong(1, entity.getId());
//           ps.setString(2, entity.getSymbol());
//           ps.setString(3, entity.getInterval());
//           ps.setTimestamp(4, entity.getDateTime() == null ? null : Timestamp.valueOf(entity.getDateTime()));
//           ps.setObject(5, entity.getOpen());
//           ps.setObject(6, entity.getHigh());
//           ps.setObject(7, entity.getLow());
//           ps.setObject(8, entity.getClose());
//           ps.setObject(9, entity.getAdjClose());
//           ps.setObject(10, entity.getVolume());
//         });
//   }

// }