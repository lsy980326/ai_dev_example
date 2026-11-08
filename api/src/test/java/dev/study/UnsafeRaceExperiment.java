package dev.study;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** Isolated counterexample: deliberately omits the session row lock. Never used by the API. */
@Tag("defect")
@Testcontainers
class UnsafeRaceExperiment {

  @Container
  static final PostgreSQLContainer DB = new PostgreSQLContainer("postgres:17.9-alpine");

  @Test
  void unlockedReadThenInsertMustNotExceedCapacity() throws Exception {
    try (var c = DB.createConnection(""); var s = c.createStatement()) {
      s.execute("CREATE TABLE seats(member_id text PRIMARY KEY)");
      s.execute("INSERT INTO seats SELECT 'seed-' || n FROM generate_series(1,7) n");
    }
    var bothReadSeven = new CyclicBarrier(2);
    try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
      var tasks = java.util.stream.IntStream.range(0, 2)
        .mapToObj(i ->
          pool.submit(() -> {
            try (var c = DB.createConnection(""); var s = c.createStatement()) {
              c.setAutoCommit(false);
              int count;
              try (var r = s.executeQuery("SELECT count(*) FROM seats")) {
                r.next();
                count = r.getInt(1);
              }
              bothReadSeven.await(5, TimeUnit.SECONDS);
              if (count < 8) s.execute("INSERT INTO seats VALUES ('member-" + i + "')");
              c.commit();
              return count;
            }
          })
        )
        .toList();
      for (var task : tasks) assertEquals(7, task.get(10, TimeUnit.SECONDS));
    }
    try (
      var c = DB.createConnection("");
      var s = c.createStatement();
      var r = s.executeQuery("SELECT count(*) FROM seats")
    ) {
      r.next();
      assertEquals(
        8,
        r.getInt(1),
        "CAPACITY_INVARIANT: expected 8; unlocked transactions actually confirmed 9"
      );
    }
  }
}
