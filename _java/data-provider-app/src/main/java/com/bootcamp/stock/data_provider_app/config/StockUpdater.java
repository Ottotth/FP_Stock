package com.bootcamp.stock.data_provider_app.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.bootcamp.stock.data_provider_app.model.enums.Interval;
import com.bootcamp.stock.data_provider_app.service.StockDataService;

@Component
public class StockUpdater {

  @Autowired
	private StockDataService stockDataService;

// --------------------------Update Stock Chart Data------------------//
  public void updateAllStockData() {
		List<String> symbols = stockDataService.getAllSymbols();
		if (symbols.isEmpty()) {
			return;
		}
		for (String symbol : symbols) {
			System.out.println("*********Updating data for symbol: " + symbol);
			for (Interval interval : Interval.values()) {
				try {
					stockDataService.updateStockChartData(symbol, interval.getValue());
				} catch (Exception ex) {
					System.out.println("Update failed for symbol: " + symbol + ", interval: " + interval);
				}
			}
		}
		System.out.println("Update Done");
	}

	


	// --------------------------Update the Old Data to other table------------------//
	public void updateOldData() {
		List<String> symbols = stockDataService.getAllSymbols();
		for (String symbol : symbols) {
			for (Interval interval : Interval.values()) {
				try {
					System.out.println("Updating old data for symbol: " + symbol + ", interval: " + interval);
					switch (interval) {
						case ONE_MINUTE:
							stockDataService.getOldStockData(symbol, interval.getValue(), 7); // Example: 7 days
							break;
						case FIVE_MINUTES:
							stockDataService.getOldStockData(symbol, interval.getValue(), 14); // Example: 14 days
							break;
						case FIFTEEN_MINUTES:
							stockDataService.getOldStockData(symbol, interval.getValue(), 30); // Example: 30 days
							break;
						case THIRTY_MINUTES:
							stockDataService.getOldStockData(symbol, interval.getValue(), 60); // Example: 60 days
							break;
						case ONE_HOUR:
							stockDataService.getOldStockData(symbol, interval.getValue(), 90); // Example: 90 days
							break;
						case FOUR_HOURS:
							stockDataService.getOldStockData(symbol, interval.getValue(), 180); // Example: 180 days
							break;
						case ONE_DAY:
							stockDataService.getOldStockData(symbol, interval.getValue(), 365); // Example: 365 days
							break;
						case ONE_WEEK:
							stockDataService.getOldStockData(symbol, interval.getValue(), 730); // Example: 730 days (2 years)
							break;
						case ONE_MONTH:
							stockDataService.getOldStockData(symbol, interval.getValue(), 1095); // Example: 1095 days (3 years)
							break;
						case THREE_MONTHS:
							stockDataService.getOldStockData(symbol, interval.getValue(), 1825); // Example: 1825 days (5 years)
							break;
						default:
							break;
					}
				} catch (Exception ex) {
					System.out.println("Update failed for symbol: " + symbol + ", interval: " + interval);
					ex.printStackTrace();
				}
			}
		}
		System.out.println("Update Old Data Done");
	}
}
