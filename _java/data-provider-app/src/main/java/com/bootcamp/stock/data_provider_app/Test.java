package com.bootcamp.stock.data_provider_app;

import java.sql.Timestamp;
import java.time.LocalDateTime;

public class Test {

  public static void main(String[] args) {
    System.out.println("Hello, World!");

    String nowtimestamp = String.valueOf(Timestamp.valueOf(LocalDateTime.now()).getTime() / 1000);
    System.out.println("nowtimestamp: " + nowtimestamp);
  }
  
}
