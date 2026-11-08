package dev.study;

import static org.junit.jupiter.api.Assertions.assertEquals;

import dev.study.jobs.DatabaseJobs;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
class RdsBootstrapCompatibilityTest {

  @Container
  static final PostgreSQLContainer DB = new PostgreSQLContainer("postgres:17.9-alpine");

  @Test
  void nonSuperuserDatabaseOwnerCanBootstrapTwiceAndMigrate() {
    var superuser = new JdbcTemplate(
      new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword())
    );
    superuser.execute(
      "CREATE ROLE managed_owner LOGIN NOSUPERUSER CREATEDB CREATEROLE PASSWORD 'test-managed-owner-only'"
    );
    superuser.execute("CREATE DATABASE managed_study OWNER managed_owner");
    var url = DB.getJdbcUrl().replace("/" + DB.getDatabaseName(), "/managed_study");
    var owner = new DriverManagerDataSource(url, "managed_owner", "test-managed-owner-only");
    DatabaseJobs.bootstrap(owner, "test-migration-only", "test-application-only");
    DatabaseJobs.bootstrap(owner, "test-migration-only", "test-application-only");
    DatabaseJobs.migrate(
      new DriverManagerDataSource(url, "study_migrator", "test-migration-only"),
      false
    );
    var app = new JdbcTemplate(
      new DriverManagerDataSource(url, "study_app", "test-application-only")
    );
    assertEquals(0L, app.queryForObject("SELECT count(*) FROM study_session", Long.class));
  }
}
