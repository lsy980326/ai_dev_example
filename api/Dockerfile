FROM eclipse-temurin:21.0.11_10-jdk-jammy AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle
RUN chmod +x gradlew
COPY src ./src
RUN --mount=type=cache,target=/root/.gradle ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21.0.11_10-jre-jammy AS runtime
RUN groupadd -g 10001 study && useradd --no-log-init -u 10001 -g study study
WORKDIR /app
COPY --from=build --chown=study:study /workspace/build/libs/app.jar /app/app.jar
COPY certs/global-bundle.pem /app/rds-ca.pem
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
