package dev.study.booking;

import java.sql.*;
import java.time.Instant;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class StudyRepository {

  private final JdbcTemplate jdbc;

  public StudyRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  private static StudySession session(ResultSet r, int ignored) throws SQLException {
    return new StudySession(
      r.getLong("id"),
      r.getString("title"),
      r.getString("description"),
      r.getTimestamp("starts_at").toInstant(),
      r.getTimestamp("closes_at").toInstant(),
      r.getInt("capacity")
    );
  }

  public Optional<StudySession> lockSession(long id) {
    return jdbc
      .query("SELECT * FROM study_session WHERE id=? FOR UPDATE", StudyRepository::session, id)
      .stream()
      .findFirst();
  }

  public Optional<Registration> findRegistration(long id, String subject) {
    return jdbc
      .query(
        "SELECT * FROM registration WHERE session_id=? AND member_subject=?",
        (r, n) ->
          new Registration(
            r.getLong("id"),
            r.getLong("session_id"),
            r.getString("member_subject"),
            r.getTimestamp("created_at").toInstant()
          ),
        id,
        subject
      )
      .stream()
      .findFirst();
  }

  public long count(long id) {
    return jdbc.queryForObject(
      "SELECT count(*) FROM registration WHERE session_id=?",
      Long.class,
      id
    );
  }

  public Registration insert(long id, String subject, Instant now) {
    long key = jdbc.queryForObject(
      "INSERT INTO registration(session_id,member_subject,created_at) VALUES(?,?,?) RETURNING id",
      Long.class,
      id,
      subject,
      Timestamp.from(now)
    );
    return new Registration(key, id, subject, now);
  }

  private static final String VIEW_SQL = """
  SELECT s.*,count(r.id) AS registered_count,
    max(r.id) FILTER (WHERE r.member_subject=?) AS my_registration_id
  FROM study_session s LEFT JOIN registration r ON r.session_id=s.id
  """;

  private static SessionView view(ResultSet r, Instant now) throws SQLException {
    var closes = r.getTimestamp("closes_at").toInstant();
    var count = r.getLong("registered_count");
    var capacity = r.getInt("capacity");
    return new SessionView(
      r.getLong("id"),
      r.getString("title"),
      r.getString("description"),
      r.getTimestamp("starts_at").toInstant(),
      closes,
      capacity,
      count,
      now.isBefore(closes) && count < capacity,
      r.getObject("my_registration_id", Long.class)
    );
  }

  public List<SessionView> list(String subject, Instant now) {
    return jdbc.query(
      VIEW_SQL + " GROUP BY s.id ORDER BY s.starts_at LIMIT 50",
      (r, n) -> view(r, now),
      subject
    );
  }

  public Optional<SessionView> detail(long id, String subject, Instant now) {
    return jdbc
      .query(VIEW_SQL + " WHERE s.id=? GROUP BY s.id", (r, n) -> view(r, now), subject, id)
      .stream()
      .findFirst();
  }
}
