package dev.study;

import java.time.Clock;
import org.springframework.context.annotation.*;

@Configuration
public class ClockConfiguration {

  @Bean
  Clock applicationClock() {
    return Clock.systemUTC();
  }
}
