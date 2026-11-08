package dev.study.booking;

public final class BookingException extends RuntimeException {

  public enum Reason {
    SESSION_NOT_FOUND,
    SESSION_FULL,
    REGISTRATION_CLOSED,
  }

  private final Reason reason;

  public BookingException(Reason reason) {
    super(reason.name());
    this.reason = reason;
  }

  public Reason reason() {
    return reason;
  }
}
