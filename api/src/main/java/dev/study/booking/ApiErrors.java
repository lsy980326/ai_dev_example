package dev.study.booking;

import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {

  public record Error(String code, String message) {}

  private static ResponseEntity<Error> error(int status, String code, String message) {
    return ResponseEntity.status(status)
      .cacheControl(CacheControl.noStore())
      .body(new Error(code, message));
  }

  @ExceptionHandler(BookingException.class)
  ResponseEntity<Error> booking(BookingException e) {
    return switch (e.reason()) {
      case SESSION_NOT_FOUND -> error(404, e.reason().name(), "해당 모임을 찾을 수 없습니다.");
      case SESSION_FULL -> error(
        409,
        e.reason().name(),
        "정원이 찼습니다. 다른 모임을 확인해 주세요."
      );
      case REGISTRATION_CLOSED -> error(409, e.reason().name(), "신청이 마감되었습니다.");
    };
  }

  @ExceptionHandler({
    HttpMessageNotReadableException.class,
    MethodArgumentTypeMismatchException.class,
  })
  ResponseEntity<Error> invalid(Exception ignored) {
    return error(400, "INVALID_REQUEST", "요청 형식을 확인해 주세요.");
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Error> invalidBody(ResponseStatusException e) {
    return error(
      e.getStatusCode().value(),
      "INVALID_REQUEST",
      e.getReason() == null ? "요청을 확인해 주세요." : e.getReason()
    );
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Error> unexpected(Exception e) {
    // Do not expose SQL, tokens, connection strings, or exception messages.
    LoggerFactory.getLogger(ApiErrors.class).error(
      "unhandled_api_error type={}",
      e.getClass().getSimpleName()
    );
    return error(500, "INTERNAL_ERROR", "결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  }
}
