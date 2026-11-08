package dev.study.security;

import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

public final class JwtPolicy {

  private JwtPolicy() {}

  public static JwtDecoder decoder(String issuer, String jwks, String audience) {
    var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
    OAuth2TokenValidator<Jwt> member = jwt -> {
      if (
        jwt.getExpiresAt() == null ||
        !jwt.getAudience().contains(audience) ||
        jwt.getSubject() == null ||
        jwt.getSubject().isBlank()
      ) {
        System.getLogger(JwtPolicy.class.getName()).log(
          System.Logger.Level.WARNING,
          "JWT policy rejected: expiryPresent=" +
            (jwt.getExpiresAt() != null) +
            " audienceMatches=" +
            jwt.getAudience().contains(audience) +
            " subjectPresent=" +
            (jwt.getSubject() != null && !jwt.getSubject().isBlank())
        );
      }
      boolean valid =
        jwt.getExpiresAt() != null &&
        jwt.getAudience().contains(audience) &&
        jwt.getSubject() != null &&
        !jwt.getSubject().isBlank();
      return valid
        ? OAuth2TokenValidatorResult.success()
        : OAuth2TokenValidatorResult.failure(
            new OAuth2Error("invalid_token", "Token audience or subject is invalid", null)
          );
    };
    decoder.setJwtValidator(
      new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), member)
    );
    return decoder;
  }
}
