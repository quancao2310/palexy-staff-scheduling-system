package com.palexy.scheduler;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;

/** Full-stack smoke test: the app boots against a real Postgres (Flyway runs) and reports ready. */
@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SchedulerApplicationTests {

    @LocalServerPort
    int port;

    @Test
    void readinessProbeIsUp() {
        RestClient client = RestClient.create("http://localhost:" + port);

        String readiness = client.get().uri("/actuator/health/readiness").retrieve().body(String.class);

        assertThat(readiness).contains("\"status\":\"UP\"");
    }
}
