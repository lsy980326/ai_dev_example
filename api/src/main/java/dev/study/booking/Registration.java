package dev.study.booking;

import java.time.Instant;

public record Registration(long id, long sessionId, String memberSubject, Instant createdAt) {}
