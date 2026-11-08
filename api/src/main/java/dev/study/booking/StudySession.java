package dev.study.booking;

import java.time.Instant;

public record StudySession(
  long id,
  String title,
  String description,
  Instant startsAt,
  Instant closesAt,
  int capacity
) {}
