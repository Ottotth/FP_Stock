package com.bootcamp.stock.data_provider_app.config.lib;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CsvLoader {

  @Value("${app.symbolsCsvPath:../../_py/sp500_list.csv}")
  private String symbolsCsvPath;

  public List<String> loadSymbolsFromCsv() {
    Path path = Paths.get(symbolsCsvPath);
    if (!Files.exists(path)) {
      System.out.println("CSV file not found: " + path.toAbsolutePath());
      return List.of();
    }

    try {
      return Files.readAllLines(path).stream().skip(1)
          .map(line -> line.split(",", 2)[0].trim()).filter(s -> !s.isEmpty())
          .distinct().collect(Collectors.toList());
    } catch (IOException e) {
      System.out.println("Failed to read CSV: " + path.toAbsolutePath());
      e.printStackTrace();
      return List.of();
    }
  }

  public String flatSymbolsList(List<String> symbols) {
    try {
      if (symbols.isEmpty()) {
        System.out.println("No symbols loaded from CSV: " + symbolsCsvPath);
        return "";
      }
      return String.join(",", symbols);
    } catch (Exception e) {
      System.out.println("Error loading symbols from CSV: " + e.getMessage());
      e.printStackTrace();
      return "";
    }
  }
}
