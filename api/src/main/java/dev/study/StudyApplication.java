package dev.study;

import java.util.*;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class StudyApplication {

  public static void main(String[] args) {
    String profiles = System.getenv().getOrDefault("SPRING_PROFILES_ACTIVE", "");
    for (String arg : args)
      if (arg.startsWith("--spring.profiles.active=")) profiles = arg.substring(
        "--spring.profiles.active=".length()
      );
    boolean job = Arrays.stream(profiles.split(",")).anyMatch(
      v -> v.equals("bootstrap") || v.equals("migration")
    );
    var application = new SpringApplication(StudyApplication.class);
    if (job) application.setWebApplicationType(WebApplicationType.NONE);
    var context = application.run(args);
    if (job) context.close();
  }
}
