package com.bootcamp.stock.data_provider_app.config;


import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;


@Component
public class AppRunner implements CommandLineRunner {
  

  @Override
  public void run(String... args) throws Exception {
    System.out.println("Data Provider App is running...");

    // stockerUpdater.updateAllStockData();
  }

  
}
