package dev.study.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class SecurityConfiguration {

  @Bean
  JwtDecoder jwtDecoder(
    @Value("${app.security.issuer}") String issuer,
    @Value("${app.security.jwk-set-uri}") String jwks,
    @Value("${app.security.audience}") String audience
  ) {
    return JwtPolicy.decoder(issuer, jwks, audience);
  }

  @Bean
  SecurityFilterChain apiSecurity(HttpSecurity http) throws Exception {
    http
      .csrf(c -> c.disable())
      .cors(c -> c.disable())
      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(a ->
        a
          .requestMatchers("/actuator/health", "/actuator/health/**")
          .permitAll()
          .requestMatchers(HttpMethod.GET, "/sessions", "/sessions/*")
          .permitAll()
          .requestMatchers(HttpMethod.POST, "/sessions/*/registrations")
          .hasAuthority("SCOPE_registration:write")
          .anyRequest()
          .denyAll()
      )
      .oauth2ResourceServer(o ->
        o
          .jwt(j -> {})
          .authenticationEntryPoint((r, s, e) ->
            json(s, 401, "UNAUTHENTICATED", "로그인이 필요합니다.")
          )
      )
      .exceptionHandling(e ->
        e
          .authenticationEntryPoint((r, s, x) ->
            json(s, 401, "UNAUTHENTICATED", "로그인이 필요합니다.")
          )
          .accessDeniedHandler((r, s, x) ->
            json(s, 403, "FORBIDDEN", "이 요청을 처리할 권한이 없습니다.")
          )
      );
    return http.build();
  }

  private static void json(
    jakarta.servlet.http.HttpServletResponse r,
    int status,
    String code,
    String message
  ) throws java.io.IOException {
    r.setStatus(status);
    r.setContentType("application/json;charset=UTF-8");
    r.setHeader("Cache-Control", "no-store");
    r.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
  }
}
