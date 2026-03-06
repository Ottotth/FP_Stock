package com.bootcamp.stock.data_provider_app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestTemplate;
import com.bootcamp.stock.data_provider_app.config.lib.RedisManager;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import javax.sql.DataSource;
import java.util.concurrent.Executor;

@Configuration
public class AppConfig {
  
  @Bean
  JdbcTemplate jdbcTemplate(DataSource dataSource) {
    return new JdbcTemplate(dataSource);
  } 

  @Bean
  public RestTemplate restTemplate() {
    return new RestTemplate();
  }

  // 定義 HttpHeaders Bean
  @Bean
  public HttpHeaders httpHeaders() {
    HttpHeaders headers = new HttpHeaders();
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");
    headers.set("Accept", "application/json");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    headers.set("Referer", "https://finance.yahoo.com/");
    headers.set("Connection", "keep-alive");
    headers.set("Cookie","A3=d=AQABBPIbEmgCEOEbNyCvKvr5u19HeZzjtQcFEgEBCAGEjGm6aVib8HgB_eMDAAcI8hsSaJzjtQc&S=AQAAAimayLfiVmoRl1Sxg-_aNlw; " );
    return headers;
  }

  // 定義 HttpEntity Bean - 使用 HttpHeaders Bean
  @Bean
  public HttpEntity<String> httpEntity(HttpHeaders httpHeaders) {
    return new HttpEntity<>(httpHeaders);
  }

  @Bean
  public RedisManager redisManager(ObjectMapper objectMapper, RedisConnectionFactory redisConnectionFactory) {
    return new RedisManager(objectMapper, redisConnectionFactory);
  }

  @Bean
  public ObjectMapper objectMapper() {
    return new ObjectMapper();
  }

  @Bean(name = "heatMapTaskExecutor")
  public Executor heatMapTaskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(1);
    executor.setMaxPoolSize(1);
    executor.setQueueCapacity(50);
    executor.setThreadNamePrefix("heatmap-worker-");
    executor.initialize();
    return executor;
  }

  
}
