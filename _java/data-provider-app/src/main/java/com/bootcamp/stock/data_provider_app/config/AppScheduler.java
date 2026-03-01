package com.bootcamp.stock.data_provider_app.config;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import com.bootcamp.stock.data_provider_app.service.StockDataService;


@SpringBootApplication
@EnableScheduling
public class AppScheduler {

	@Autowired
	private StockUpdater stockUpdater;

	@Autowired
	private StockDataService stockDataService;

	private final AtomicBoolean running = new AtomicBoolean(false);

	// run in weekday 06:00 UTC
	@Scheduled(cron = "0 0 6 ? * MON-FRI", zone = "UTC")
	public void updateAt0600UTC() {
		stockUpdater.updateAllStockData();
	}

	
	@Scheduled(cron = "0 0 7 ? * MON-FRI", zone = "UTC")
	public void removeOldData() {
		stockUpdater.updateOldData();
	}

	// run after finsh runing ownload the heat map data every 5s in weekday
	@Scheduled(fixedDelay = 5000, zone = "America/New_York")
	public void updateHeatMapData() {
		ZonedDateTime now = ZonedDateTime.now(ZoneId.of("America/New_York"));
    DayOfWeek dow = now.getDayOfWeek();
    if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) return;

    LocalTime t = now.toLocalTime();
    LocalTime open = LocalTime.of(9, 30);
    LocalTime close = LocalTime.of(16, 0);

    if (t.isBefore(open) || t.isAfter(close)) return;

    if (!running.compareAndSet(false, true)) return; // 已有執行中則跳過
    try {
      stockDataService.updateHeatMapData(/* 可傳 symbols 或空 */);
			System.out.println("Heat map data updated at " + now);
    } finally {
       running.set(false);
    }
	}
}
