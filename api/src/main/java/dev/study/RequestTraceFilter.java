package dev.study;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTraceFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
    HttpServletRequest request,
    HttpServletResponse response,
    FilterChain chain
  ) throws ServletException, IOException {
    String supplied = request.getHeader("X-Request-ID");
    String id =
      supplied != null && supplied.matches("[a-zA-Z0-9-]{1,64}")
        ? supplied
        : UUID.randomUUID().toString();
    response.setHeader("X-Request-ID", id);
    long start = System.nanoTime();
    try {
      chain.doFilter(request, response);
    } finally {
      LoggerFactory.getLogger(RequestTraceFilter.class).info(
        "requestId={} method={} path={} status={} durationMs={}",
        id,
        request.getMethod(),
        request.getServletPath(),
        response.getStatus(),
        (System.nanoTime() - start) / 1_000_000
      );
    }
  }
}
