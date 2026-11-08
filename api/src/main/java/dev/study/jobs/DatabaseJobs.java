package dev.study.jobs;

import java.sql.*;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;

public final class DatabaseJobs {

  private DatabaseJobs() {}

  public static void bootstrap(DataSource dataSource, String migratorPassword, String appPassword) {
    if (
      migratorPassword.length() < 16 || appPassword.length() < 16
    ) throw new IllegalArgumentException(
      "Database role passwords must have at least 16 characters"
    );
    try (var connection = dataSource.getConnection()) {
      connection.setAutoCommit(false);
      role(connection, "study_migrator", migratorPassword);
      role(connection, "study_app", appPassword);
      try (var s = connection.createStatement()) {
        s.execute("GRANT USAGE,CREATE ON SCHEMA public TO study_migrator");
        s.execute("GRANT USAGE ON SCHEMA public TO study_app");
      }
      connection.commit();
    } catch (SQLException e) {
      // DDL contains passwords: never attach the original SQL exception to startup logs.
      throw new IllegalStateException(
        "Database role bootstrap failed; SQLState=" + e.getSQLState()
      );
    }
  }

  private static void role(Connection c, String name, String password) throws SQLException {
    if (
      !name.equals("study_migrator") && !name.equals("study_app")
    ) throw new IllegalArgumentException("Unknown application role");
    boolean exists;
    try (var p = c.prepareStatement("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=?)")) {
      p.setString(1, name);
      try (var r = p.executeQuery()) {
        r.next();
        exists = r.getBoolean(1);
      }
    }
    String ddl;
    try (var p = c.prepareStatement("SELECT format(?, ?, ?)")) {
      // RDS master is not PostgreSQL SUPERUSER. CREATE defaults are unprivileged;
      // specifying NOSUPERUSER on ALTER would itself require superuser authority.
      p.setString(1, (exists ? "ALTER" : "CREATE") + " ROLE %I WITH LOGIN PASSWORD %L");
      p.setString(2, name);
      p.setString(3, password);
      try (var r = p.executeQuery()) {
        r.next();
        ddl = r.getString(1);
      }
    }
    try (var s = c.createStatement()) {
      s.execute(ddl);
    }
    try (
      var p = c.prepareStatement(
        "SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls AS privileged FROM pg_roles WHERE rolname=?"
      )
    ) {
      p.setString(1, name);
      try (var r = p.executeQuery()) {
        r.next();
        if (r.getBoolean(1)) throw new SQLException(
          "Refusing privileged application role",
          "42501"
        );
      }
    }
  }

  public static void migrate(DataSource dataSource, boolean demo) {
    String[] locations = demo
      ? new String[] { "classpath:db/migration", "classpath:db/demo" }
      : new String[] { "classpath:db/migration" };
    Flyway.configure().dataSource(dataSource).locations(locations).load().migrate();
  }
}
