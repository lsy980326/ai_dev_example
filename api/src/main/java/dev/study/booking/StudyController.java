package dev.study.booking;

import java.time.Clock;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/sessions")
public class StudyController {

  private final StudyRepository repository;
  private final RegistrationService registrations;
  private final Clock clock;

  public StudyController(
    StudyRepository repository,
    RegistrationService registrations,
    Clock clock
  ) {
    this.repository = repository;
    this.registrations = registrations;
    this.clock = clock;
  }

  @GetMapping
  public List<SessionView> list(@AuthenticationPrincipal Jwt jwt) {
    return repository.list(jwt == null ? null : jwt.getSubject(), clock.instant());
  }

  @GetMapping("/{id}")
  public SessionView detail(@PathVariable long id, @AuthenticationPrincipal Jwt jwt) {
    return repository
      .detail(id, jwt == null ? null : jwt.getSubject(), clock.instant())
      .orElseThrow(() -> new BookingException(BookingException.Reason.SESSION_NOT_FOUND));
  }

  public record RegistrationView(long registrationId, long sessionId, String status) {}

  @PostMapping("/{id}/registrations")
  public ResponseEntity<RegistrationView> join(
    @PathVariable long id,
    @AuthenticationPrincipal Jwt jwt,
    @RequestBody(required = false) Map<String, Object> body
  ) {
    if (body != null && !body.isEmpty()) throw new ResponseStatusException(
      HttpStatus.BAD_REQUEST,
      "신청 요청에는 회원 정보를 보내지 않습니다."
    );
    var result = registrations.join(id, jwt.getSubject());
    return ResponseEntity.status(result.created() ? 201 : 200)
      .cacheControl(CacheControl.noStore())
      .body(new RegistrationView(result.registration().id(), id, "CONFIRMED"));
  }
}
