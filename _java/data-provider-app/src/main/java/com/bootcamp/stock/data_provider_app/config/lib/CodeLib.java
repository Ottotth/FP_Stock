package com.bootcamp.stock.data_provider_app.config.lib;

import java.time.ZonedDateTime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.repository.SPListRepository;

@Component
public class CodeLib {

@Autowired
private SPListRepository spListRepository;  

  public boolean isValidSymbol(String symbol) {
    // 允許的股票代碼格式：1-5個英數字，且可包含連字號或插入符號（如 "BRK-B" 或 "RDS.A"）
    return spListRepository.existsBySymbol(symbol);
  }

  public ZonedDateTime calculateLatestDateTime(String interval) {
    ZonedDateTime latestDateTime = null;
    if (latestDateTime == null) {
      switch (interval) {
        case "1m":
          latestDateTime = ZonedDateTime.now().minusDays(7);
          break;
        case "5m":
          latestDateTime = ZonedDateTime.now().minusDays(30);
          break;
        case "15m":
          latestDateTime = ZonedDateTime.now().minusDays(90);
          break;
        case "30m":
          latestDateTime = ZonedDateTime.now().minusDays(180);
          break;
        case "1d":
          latestDateTime = ZonedDateTime.now().minusDays(365);
          break;
        case "1wk":
          latestDateTime = ZonedDateTime.now().minusDays(730);
          break;
        case "1mo":
          latestDateTime = ZonedDateTime.now().minusDays(1095);
          break;
        case "3mo":
          latestDateTime = ZonedDateTime.now().minusDays(1825);
          break;
        default:
          // 若 interval 不符合預期格式，則退回到往前 8 天作為起始時間
          System.out.println("Unknown interval: " + interval + ", defaulting to 8 days");
          latestDateTime = ZonedDateTime.now().minusDays(8);
      }
    }
    return latestDateTime;
  }
  
}
