package dev.study;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
@Import(RegistrationIntegrationTest.TimeConfig.class)
class RegistrationIntegrationTest {

  static final Instant NOW = Instant.parse("2026-11-08T03:00:00Z");

  @Container
  static final PostgreSQLContainer DB = new PostgreSQLContainer(
    "postgres:17.9-alpine"
  ).withInitScript("db/test-bootstrap.sql");

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry p) {
    p.add("DATABASE_URL", DB::getJdbcUrl);
    p.add("DATABASE_USER", () -> "study_app");
    p.add("DATABASE_PASSWORD", () -> "test-app-only");
    p.add("OIDC_ISSUER", () -> "https://issuer.example.test");
    p.add("OIDC_JWKS_URI", () -> "http://127.0.0.1:1/unused-by-mock-jwt");
  }

  @Autowired
  MockMvc mvc;

  @Autowired
  MutableClock clock;

  @Autowired
  DataSource runtimeDataSource;

  JdbcTemplate admin;

  @BeforeAll
  static void migrate() {
    Flyway.configure()
      .dataSource(DB.getJdbcUrl(), "study_migrator", "test-migration-only")
      .load()
      .migrate();
  }

  @BeforeEach
  void fixture() {
    clock.set(NOW);
    admin = new JdbcTemplate(
      new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword())
    );
    admin.execute("TRUNCATE registration,study_session RESTART IDENTITY CASCADE");
    admin.update(
      "INSERT INTO study_session(id,title,description,starts_at,closes_at,capacity) VALUES(17,'설계 스터디','함께 설계합니다.',?,?,8)",
      java.sql.Timestamp.from(NOW.plusSeconds(7200)),
      java.sql.Timestamp.from(NOW.plusSeconds(3600))
    );
    for (int i = 1; i <= 7; i++) admin.update(
      "INSERT INTO registration(session_id,member_subject,created_at) VALUES(17,?,?)",
      "seed-" + i,
      java.sql.Timestamp.from(NOW)
    );
  }

  static RequestPostProcessor member(String id) {
    return jwt()
      .jwt(j -> j.subject(id))
      .authorities(new SimpleGrantedAuthority("SCOPE_registration:write"));
  }

  MvcResult join(String id) throws Exception {
    return mvc
      .perform(
        post("/sessions/17/registrations")
          .with(member(id))
          .contentType("application/json")
          .content("{}")
      )
      .andReturn();
  }

  List<MvcResult> parallel(String a, String b) throws Exception {
    var barrier = new CyclicBarrier(2);
    try (var e = Executors.newVirtualThreadPerTaskExecutor()) {
      var x = e.submit(() -> {
        barrier.await(5, TimeUnit.SECONDS);
        return join(a);
      });
      var y = e.submit(() -> {
        barrier.await(5, TimeUnit.SECONDS);
        return join(b);
      });
      return List.of(x.get(10, TimeUnit.SECONDS), y.get(10, TimeUnit.SECONDS));
    }
  }

  long count() {
    return admin.queryForObject(
      "SELECT count(*) FROM registration WHERE session_id=17",
      Long.class
    );
  }

  static long registrationId(MvcResult r) throws Exception {
    Number id = JsonPath.read(r.getResponse().getContentAsString(), "$.registrationId");
    return id.longValue();
  }

  @Test
  void createsOneRegistrationForAnAuthenticatedMember() throws Exception {
    var r = join("member-a");
    assertEquals(201, r.getResponse().getStatus());
    assertEquals("CONFIRMED", JsonPath.read(r.getResponse().getContentAsString(), "$.status"));
    assertEquals(8, count());
  }

  @Test
  void confirmsOnlyOneMemberForTheLastSeat() throws Exception {
    var r = parallel("member-a", "member-b");
    assertEquals(
      List.of(201, 409),
      r
        .stream()
        .map(x -> x.getResponse().getStatus())
        .sorted()
        .toList()
    );
    assertEquals(8, count());
    var rejected = r
      .stream()
      .filter(x -> x.getResponse().getStatus() == 409)
      .findFirst()
      .orElseThrow();
    assertEquals(
      "SESSION_FULL",
      JsonPath.read(rejected.getResponse().getContentAsString(), "$.code")
    );
  }

  @Test
  void sameMemberConcurrentRetryReturnsTheSameRegistration() throws Exception {
    var r = parallel("member-a", "member-a");
    assertEquals(
      List.of(200, 201),
      r
        .stream()
        .map(x -> x.getResponse().getStatus())
        .sorted()
        .toList()
    );
    assertEquals(registrationId(r.get(0)), registrationId(r.get(1)));
    assertEquals(
      1L,
      admin.queryForObject(
        "SELECT count(*) FROM registration WHERE member_subject='member-a'",
        Long.class
      )
    );
    assertEquals(8, count());
  }

  @Test
  void existingRegistrationIsReturnedAfterDeadlineAndAtCapacity() throws Exception {
    var first = join("member-a");
    clock.set(NOW.plusSeconds(4000));
    var again = join("member-a");
    assertEquals(200, again.getResponse().getStatus());
    assertEquals(registrationId(first), registrationId(again));
    assertEquals(8, count());
  }

  @Test
  void rejectsNewRegistrationAtTheDeadline() throws Exception {
    clock.set(NOW.plusSeconds(3600));
    var r = join("member-a");
    assertEquals(409, r.getResponse().getStatus());
    assertEquals(
      "REGISTRATION_CLOSED",
      JsonPath.read(r.getResponse().getContentAsString(), "$.code")
    );
    assertEquals(7, count());
  }

  @Test
  void evaluatesDeadlineAfterWaitingForTheSessionLock() throws Exception {
    try (
      Connection holder = admin.getDataSource().getConnection();
      var e = Executors.newVirtualThreadPerTaskExecutor()
    ) {
      holder.setAutoCommit(false);
      holder.createStatement().execute("SELECT id FROM study_session WHERE id=17 FOR UPDATE");
      var future = e.submit(() -> join("member-a"));
      await()
        .atMost(Duration.ofSeconds(5))
        .until(
          () ->
            admin.queryForObject(
              "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query ILIKE '%FOR UPDATE%'",
              Long.class
            ) > 0
        );
      clock.set(NOW.plusSeconds(3600));
      holder.commit();
      var r = future.get(5, TimeUnit.SECONDS);
      assertEquals(409, r.getResponse().getStatus());
      assertEquals(
        "REGISTRATION_CLOSED",
        JsonPath.read(r.getResponse().getContentAsString(), "$.code")
      );
      assertEquals(7, count());
    }
  }

  @Test
  void rejectsCallerSuppliedMemberIdentity() throws Exception {
    mvc
      .perform(
        post("/sessions/17/registrations")
          .with(member("member-a"))
          .contentType("application/json")
          .content("{\"memberId\":\"victim\"}")
      )
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
    assertEquals(7, count());
  }

  @Test
  void requiresAuthenticationAndWriteScope() throws Exception {
    mvc
      .perform(post("/sessions/17/registrations").contentType("application/json").content("{}"))
      .andExpect(status().isUnauthorized());
    mvc
      .perform(
        post("/sessions/17/registrations")
          .with(jwt().authorities(new SimpleGrantedAuthority("SCOPE_profile")))
          .contentType("application/json")
          .content("{}")
      )
      .andExpect(status().isForbidden());
    assertEquals(7, count());
  }

  @Test
  void returnsNotFoundForAnUnknownSession() throws Exception {
    mvc
      .perform(
        post("/sessions/999/registrations")
          .with(member("member-a"))
          .contentType("application/json")
          .content("{}")
      )
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  void publicSessionDataDoesNotRevealOtherMemberIdentities() throws Exception {
    mvc
      .perform(get("/sessions"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$[0].registeredCount").value(7))
      .andExpect(jsonPath("$[0].myRegistrationId").isEmpty())
      .andExpect(jsonPath("$[0].memberSubject").doesNotExist());
    join("member-a");
    mvc
      .perform(get("/sessions/17").with(member("member-a")))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.myRegistrationId").isNumber());
  }

  @Test
  void runtimeDatabaseRoleCannotDeleteRegistrationsOrCreateTables() throws Exception {
    try (var c = runtimeDataSource.getConnection(); var s = c.createStatement()) {
      assertEquals(
        "42501",
        assertThrows(SQLException.class, () -> s.execute("DELETE FROM registration")).getSQLState()
      );
      assertEquals(
        "42501",
        assertThrows(SQLException.class, () ->
          s.execute("CREATE TABLE forbidden_runtime_ddl(id int)")
        ).getSQLState()
      );
      assertEquals(
        "42501",
        assertThrows(SQLException.class, () ->
          s.execute("UPDATE study_session SET capacity=200 WHERE id=17")
        ).getSQLState()
      );
      assertEquals(
        "42501",
        assertThrows(SQLException.class, () ->
          s.execute("UPDATE study_session SET closes_at=starts_at-interval '1 minute' WHERE id=17")
        ).getSQLState()
      );
    }
  }

  @Test
  void runtimeDatabaseRoleCanLockTheSessionWithoutChangingItsPolicy() throws Exception {
    try (var c = runtimeDataSource.getConnection(); var s = c.createStatement()) {
      c.setAutoCommit(false);
      try (var rows = s.executeQuery("SELECT id FROM study_session WHERE id=17 FOR UPDATE")) {
        assertTrue(rows.next());
      }
      c.rollback();
    }
  }

  static final class MutableClock extends Clock {

    private final AtomicReference<Instant> now = new AtomicReference<>(NOW);

    void set(Instant v) {
      now.set(v);
    }

    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    public Clock withZone(ZoneId z) {
      if (!ZoneOffset.UTC.equals(z)) throw new IllegalArgumentException("UTC only");
      return this;
    }

    public Instant instant() {
      return now.get();
    }
  }

  @TestConfiguration
  static class TimeConfig {

    @Bean
    @Primary
    MutableClock testClock() {
      return new MutableClock();
    }
  }
}
