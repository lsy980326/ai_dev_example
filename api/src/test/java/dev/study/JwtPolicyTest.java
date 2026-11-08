package dev.study;

import static org.junit.jupiter.api.Assertions.*;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import dev.study.security.JwtPolicy;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class JwtPolicyTest {

  static final String ISSUER = "https://identity.example.test/realms/study";
  static RSAKey key;
  static HttpServer server;
  static JwtDecoder decoder;

  @BeforeAll
  static void setup() throws Exception {
    key = new RSAKeyGenerator(2048).keyID("test-key").generate();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.createContext("/jwks", exchange -> {
      byte[] body = new JWKSet(key.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json");
      exchange.sendResponseHeaders(200, body.length);
      try (var stream = exchange.getResponseBody()) {
        stream.write(body);
      }
    });
    server.start();
    decoder = JwtPolicy.decoder(
      ISSUER,
      "http://127.0.0.1:" + server.getAddress().getPort() + "/jwks",
      "study-api"
    );
  }

  @AfterAll
  static void stop() {
    if (server != null) server.stop(0);
  }

  static String token(
    RSAKey signingKey,
    String issuer,
    String audience,
    String subject,
    Instant expires
  ) throws Exception {
    var claims = new JWTClaimsSet.Builder()
      .issuer(issuer)
      .audience(audience)
      .subject(subject)
      .issueTime(Date.from(Instant.now()))
      .claim("scope", "registration:write")
      .build();
    if (expires != null) claims = new JWTClaimsSet.Builder(claims)
      .expirationTime(Date.from(expires))
      .build();
    var jwt = new SignedJWT(
      new JWSHeader.Builder(JWSAlgorithm.RS256).type(JOSEObjectType.JWT).keyID("test-key").build(),
      claims
    );
    jwt.sign(new RSASSASigner(signingKey));
    return jwt.serialize();
  }

  @Test
  void acceptsTrustedMemberToken() throws Exception {
    assertEquals(
      "member-a",
      decoder
        .decode(token(key, ISSUER, "study-api", "member-a", Instant.now().plusSeconds(300)))
        .getSubject()
    );
  }

  @Test
  void rejectsWrongIssuer() throws Exception {
    var raw = token(
      key,
      "https://attacker.example",
      "study-api",
      "member-a",
      Instant.now().plusSeconds(300)
    );
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }

  @Test
  void rejectsWrongAudience() throws Exception {
    var raw = token(key, ISSUER, "another-api", "member-a", Instant.now().plusSeconds(300));
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }

  @Test
  void rejectsBlankSubject() throws Exception {
    var raw = token(key, ISSUER, "study-api", " ", Instant.now().plusSeconds(300));
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }

  @Test
  void rejectsExpiredToken() throws Exception {
    var raw = token(key, ISSUER, "study-api", "member-a", Instant.now().minusSeconds(300));
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }

  @Test
  void rejectsTokenWithoutExpiration() throws Exception {
    var raw = token(key, ISSUER, "study-api", "member-a", null);
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }

  @Test
  void rejectsUntrustedSigningKey() throws Exception {
    var other = new RSAKeyGenerator(2048).keyID("test-key").generate();
    var raw = token(other, ISSUER, "study-api", "member-a", Instant.now().plusSeconds(300));
    assertThrows(JwtException.class, () -> decoder.decode(raw));
  }
}
