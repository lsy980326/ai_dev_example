package dev.study.booking;

import java.time.Instant;

public record SessionView(
  long id,
  String title,
  String description,
  Instant startsAt,
  Instant closesAt,
  int capacity,
  long registeredCount,
  boolean registrationOpen,
  Long myRegistrationId
) {}
