package com.bootcamp.stock.data_provider_app.config.lib;

import java.time.Duration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;
import tools.jackson.databind.ObjectMapper;

public class RedisManager {

  private RedisTemplate<String, String> redisTemplate;
  private ObjectMapper objectMapper;

  public RedisManager(ObjectMapper objectMapper, RedisConnectionFactory redisConnectionFactory) {
    RedisTemplate<String, String> redisTemplate = new RedisTemplate<>();
    redisTemplate.setConnectionFactory(redisConnectionFactory);
    redisTemplate.setKeySerializer(RedisSerializer.string());
    redisTemplate.setValueSerializer(RedisSerializer.json()); // object -> json -> String
    redisTemplate.afterPropertiesSet();

    this.redisTemplate = redisTemplate;
    this.objectMapper = objectMapper;
  }

  // getter
  // setter

  // Read
  // 
  public <T> T get(String key, Class<T> clazz){
    String json = this.redisTemplate.opsForValue().get(key);
    if (json == null) {
      return null;
    }
    return this.objectMapper.readValue(json, clazz);
  }

  // Write
  // set
  public <T> void set(String key, T value, Duration duration) {
    // null check (Key should not be null , but value can be null)
    if (key == null) {
      throw new IllegalArgumentException("Key must not be null");
    }
    String json = this.objectMapper.writeValueAsString(value);
    this.redisTemplate.opsForValue().set(key, json, duration);
  }
}
