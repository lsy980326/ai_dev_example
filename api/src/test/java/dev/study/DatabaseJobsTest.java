package dev.study;

import static org.junit.jupiter.api.Assertions.*;

import dev.study.jobs.DatabaseJobs;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class DatabaseJobsTest {

  @Container
  static final PostgreSQLContainer DB = new PostgreSQLContainer("postgres:17.9-alpine");

  @Test
  void bootstrapsQuotedPasswordsAndMigratesWithoutGivingTheAppDdlRights() throws Exception {
    var owner = new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
    DatabaseJobs.bootstrap(owner, "test'migration-password!", "test'app-password!");
    var admin = new JdbcTemplate(owner);
    assertEquals(
      2L,
      admin.queryForObject(
        "SELECT count(*) FROM pg_roles WHERE rolname IN ('study_migrator','study_app')",
        Long.class
      )
    );
    var migrator = new DriverManagerDataSource(
      DB.getJdbcUrl(),
      "study_migrator",
      "test'migration-password!"
    );
    DatabaseJobs.migrate(migrator, false);
    var app = new DriverManagerDataSource(DB.getJdbcUrl(), "study_app", "test'app-password!");
    assertEquals(
      0L,
      new JdbcTemplate(app).queryForObject("SELECT count(*) FROM study_session", Long.class)
    );
    try (var c = app.getConnection(); var s = c.createStatement()) {
      assertEquals(
        "42501",
        assertThrows(java.sql.SQLException.class, () ->
          s.execute("CREATE TABLE forbidden(id int)")
        ).getSQLState()
      );
    }
    DatabaseJobs.bootstrap(owner, "test'migration-password!", "test'app-password!");
    DatabaseJobs.migrate(migrator, true);
    assertEquals(
      7L,
      new JdbcTemplate(app).queryForObject(
        "SELECT count(*) FROM registration WHERE session_id=17",
        Long.class
      )
    );
  }
}
