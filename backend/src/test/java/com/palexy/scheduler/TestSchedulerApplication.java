package com.palexy.scheduler;

import org.springframework.boot.SpringApplication;

/**
 * Dev-time entry point: {@code ./mvnw spring-boot:test-run} starts the app against a
 * disposable Testcontainers Postgres, so no database setup is needed.
 */
public class TestSchedulerApplication {

    public static void main(String[] args) {
        SpringApplication.from(SchedulerApplication::main)
                .with(TestcontainersConfiguration.class)
                .run(args);
    }
}
