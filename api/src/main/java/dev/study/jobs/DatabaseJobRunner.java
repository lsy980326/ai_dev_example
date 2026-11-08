package dev.study.jobs;

import javax.sql.DataSource;
import org.springframework.boot.*;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@Profile({ "bootstrap", "migration" })
public class DatabaseJobRunner implements ApplicationRunner {

  private final DataSource dataSource;
  private final Environment environment;

  public DatabaseJobRunner(DataSource dataSource, Environment environment) {
    this.dataSource = dataSource;
    this.environment = environment;
  }

  @Override
  public void run(ApplicationArguments args) {
    if (environment.matchesProfiles("bootstrap")) DatabaseJobs.bootstrap(
      dataSource,
      environment.getRequiredProperty("MIGRATOR_PASSWORD"),
      environment.getRequiredProperty("APP_DB_PASSWORD")
    );
    else {
      boolean demo = environment.matchesProfiles("local");
      if (
        demo && !"local".equals(environment.getProperty("APP_MODE"))
      ) throw new IllegalStateException("Demo seed requires explicit local mode");
      DatabaseJobs.migrate(dataSource, demo);
    }
  }
}
