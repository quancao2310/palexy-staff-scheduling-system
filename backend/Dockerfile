# syntax=docker/dockerfile:1

# Multi-stage build for the Spring Boot API:
#   deps    -> resolve Maven dependencies (cached until pom.xml changes)
#   build   -> compile, package, and split the jar into layers (Spring's `jarmode=tools`)
#   runtime -> JRE only, non-root, layers copied so rebuilds only re-push what changed

# Latest LTS (Java 25). Used for both the build JDK and the runtime JRE.
ARG JAVA_VERSION=25

################################################################################
# 1. Dependencies: separate layer so editing source code does not re-download the world.
FROM eclipse-temurin:${JAVA_VERSION}-jdk-noble AS deps
WORKDIR /build

COPY --chmod=0755 mvnw mvnw
COPY .mvn/ .mvn/
RUN --mount=type=bind,source=pom.xml,target=pom.xml \
    --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -ntp dependency:go-offline

################################################################################
# 2. Build: package the app, then extract it into Docker-friendly layers
#    (dependencies / spring-boot-loader / snapshot-dependencies / application).
FROM deps AS build
COPY src/ src/
RUN --mount=type=bind,source=pom.xml,target=pom.xml \
    --mount=type=cache,target=/root/.m2 \
    ./mvnw -B -ntp -DskipTests package \
    && cp target/scheduler.jar application.jar \
    && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

################################################################################
# 3. Runtime: JRE only (no compiler, no Maven), unprivileged user.
FROM eclipse-temurin:${JAVA_VERSION}-jre-noble AS runtime

ARG UID=10001
RUN groupadd --gid "${UID}" app \
    && useradd --uid "${UID}" --gid app --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin app

WORKDIR /app

# Least-changing layers first so Docker's cache and registry pushes stay small.
# Files stay root-owned and read-only to the app user: the process cannot modify its own code.
COPY --from=build /build/extracted/dependencies/ ./
COPY --from=build /build/extracted/spring-boot-loader/ ./
COPY --from=build /build/extracted/snapshot-dependencies/ ./
COPY --from=build /build/extracted/application/ ./

USER app

# Size the heap from the container's memory limit; die (and get restarted) rather than limp on after OOM.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

EXPOSE 8080

# Exec form: java is PID 1 and receives SIGTERM, so Spring's graceful shutdown runs.
ENTRYPOINT ["java", "-jar", "application.jar"]
