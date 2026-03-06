package com.bootcamp.stock.data_provider_app.config;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import com.bootcamp.stock.data_provider_app.service.StockDataService;


@SpringBootApplication
@EnableScheduling
public class AppScheduler {

	@Autowired
	private StockDataService stockDataService;

	@Autowired
	private StockUpdater stockUpdater;

	@Autowired
	@Qualifier("heatMapTaskExecutor")
	private Executor heatMapTaskExecutor;

	private final AtomicBoolean running = new AtomicBoolean(false);

	// run in weekday 00:00 UTC
	@Scheduled(cron = "0 0 0 ? * MON-FRI", zone = "UTC")
	public void updateAt0000UTC() {
		stockUpdater.updateAllStockData();
	}

	
	@Scheduled(cron = "0 0 1 ? * MON-FRI", zone = "UTC")
	public void removeOldData() {
		stockUpdater.updateOldData();
	}

	// run after finsh runing ownload the heat map data every 3s in weekday
	@Scheduled(fixedDelay = 3000, zone = "America/New_York")
	public void updateHeatMapData() {
		ZonedDateTime now = ZonedDateTime.now(ZoneId.of("America/New_York"));
		DayOfWeek dayOfWeek = now.getDayOfWeek();
		if (dayOfWeek == DayOfWeek.SATURDAY || dayOfWeek == DayOfWeek.SUNDAY) return;

		LocalTime current = now.toLocalTime();
		LocalTime open = LocalTime.of(9, 30);
		LocalTime close = LocalTime.of(16, 0);

		if (current.isBefore(open) || current.isAfter(close)) return;

		if (!running.compareAndSet(false, true)) return;
		try {
			heatMapTaskExecutor.execute(() -> {
				try {
					stockDataService.updateHeatMapData();
					System.out.println("Heat map data updated at " + ZonedDateTime.now(ZoneId.of("America/New_York")));
				} catch (Exception e) {
					System.out.println("Heat map update failed: " + e.getMessage());
				} finally {
					running.set(false);
				}
			});
		} catch (Exception e) {
			System.out.println("Heat map task submit failed: " + e.getMessage());
			running.set(false);
		}
	}
}
