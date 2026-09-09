# syntax=docker/dockerfile:1
#
# Reference/learning variant of backend/Dockerfile — not used by `infra` (CDK's
# ContainerImage.fromAsset looks up the plain `Dockerfile` by default).
# Demonstrates additional concepts on top of the production one: separate
# deps/build stages, BuildKit cache mounts, ARG/LABEL, non-root user,
# HEALTHCHECK, and an overridable JAVA_OPTS entrypoint.
#
# Build context is the repo root (see docker-samples/docker-compose.yml),
# so COPY paths below are prefixed with backend/.

ARG JAVA_VERSION=17

# ---- deps: resolve Maven dependencies, cached separately from source ----
FROM maven:3.9-eclipse-temurin-${JAVA_VERSION} AS deps
WORKDIR /app
COPY backend/pom.xml .
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B dependency:go-offline

# ---- build: compile + package, reusing the dependency cache ----
FROM maven:3.9-eclipse-temurin-${JAVA_VERSION} AS build
WORKDIR /app
COPY --from=deps /root/.m2 /root/.m2
COPY backend/pom.xml .
COPY backend/src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B package -DskipTests

# ---- runtime: JRE only, no Maven/JDK/source in the final image ----
FROM eclipse-temurin:${JAVA_VERSION}-jre-alpine AS runtime

ARG APP_VERSION=dev
LABEL org.opencontainers.image.title="items-backend" \
      org.opencontainers.image.version="${APP_VERSION}"

ENV JAVA_OPTS="" \
    SPRING_PROFILES_ACTIVE=prod

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

# Non-root: Alpine ships no default unprivileged user, so create one
RUN addgroup -S spring && adduser -S spring -G spring
USER spring

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:8080/actuator/health || exit 1

# ENTRYPOINT fixed; JAVA_OPTS overridable via env at `docker run`/compose without editing the image
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
