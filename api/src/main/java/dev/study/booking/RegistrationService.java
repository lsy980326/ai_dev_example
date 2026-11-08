package dev.study.booking;

import static dev.study.booking.BookingException.Reason.*;

import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class RegistrationService {

  private final StudyRepository repository;
  private final Clock clock;

  public RegistrationService(StudyRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  public record JoinResult(Registration registration, boolean created) {}

  @Transactional(isolation = Isolation.READ_COMMITTED, timeout = 10)
  public JoinResult join(long sessionId, String memberSubject) {
    var session = repository
      .lockSession(sessionId)
      .orElseThrow(() -> new BookingException(SESSION_NOT_FOUND));
    var existing = repository.findRegistration(sessionId, memberSubject);
    if (existing.isPresent()) return new JoinResult(existing.get(), false);
    // Use the time after acquiring the lock, not PostgreSQL transaction-start now().
    var now = clock.instant();
    if (!now.isBefore(session.closesAt())) throw new BookingException(REGISTRATION_CLOSED);
    if (repository.count(sessionId) >= session.capacity()) throw new BookingException(SESSION_FULL);
    return new JoinResult(repository.insert(sessionId, memberSubject, now), true);
  }
}
