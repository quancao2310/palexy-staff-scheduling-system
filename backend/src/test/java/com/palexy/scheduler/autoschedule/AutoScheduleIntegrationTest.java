package com.palexy.scheduler.autoschedule;

import com.palexy.scheduler.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "app.demo-data.enabled=false")
class AutoScheduleIntegrationTest {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {
    };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {
    };

    @LocalServerPort
    int port;

    RestClient client;

    @BeforeEach
    void setUp() {
        client = RestClient.create("http://localhost:" + port);
    }

    private long createSchedule() {
        Map<String, Object> created = client.post().uri("/api/schedules").body(Map.of("name", "Test store"))
                .retrieve().body(MAP);
        return id(created);
    }

    private long addStaff(long scheduleId, String name, int maxHours) {
        Map<String, Object> created = client.post().uri("/api/schedules/{id}/staff", scheduleId)
                .body(Map.of("name", name, "maxWeeklyHours", maxHours)).retrieve().body(MAP);
        return id(created);
    }

    private void uploadSampleTransactions(long scheduleId) throws IOException {
        byte[] csv = new ClassPathResource("demo/sample_transaction_interview.csv").getContentAsByteArray();
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(csv) {
            @Override
            public String getFilename() {
                return "sample.csv";
            }
        });
        client.put().uri("/api/schedules/{id}/transactions", scheduleId)
                .contentType(MediaType.MULTIPART_FORM_DATA).body(body).retrieve().toBodilessEntity();
    }

    private long readySchedule() throws IOException {
        long scheduleId = createSchedule();
        for (int i = 1; i <= 6; i++) {
            addStaff(scheduleId, "Person " + i, 40);
        }
        uploadSampleTransactions(scheduleId);
        return scheduleId;
    }

    private Map<String, Object> autoSchedule(long scheduleId) {
        return client.post().uri("/api/schedules/{id}/auto-schedule", scheduleId).retrieve().body(MAP);
    }

    private List<Map<String, Object>> assignments(long scheduleId) {
        return client.get().uri("/api/schedules/{id}/assignments", scheduleId).retrieve().body(LIST);
    }

    private static long id(Map<String, Object> body) {
        return ((Number) body.get("id")).longValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> body, String key) {
        return (List<Map<String, Object>>) body.get(key);
    }

    @Test
    void draftsARosterWithinEveryonesMaximumAndServesItBack() throws IOException {
        long scheduleId = readySchedule();

        Map<String, Object> result = autoSchedule(scheduleId);

        assertThat(list(result, "assignments")).isNotEmpty();
        @SuppressWarnings("unchecked")
        Map<String, Object> stats = (Map<String, Object>) result.get("stats");
        for (Map<String, Object> load : list(stats, "staff")) {
            assertThat(((Number) load.get("hours")).intValue())
                    .isLessThanOrEqualTo(((Number) load.get("maxHours")).intValue());
        }
        assertThat(assignments(scheduleId)).isEqualTo(list(result, "assignments"));
    }

    @Test
    void runningAgainReplacesTheRosterInsteadOfDuplicatingIt() throws IOException {
        long scheduleId = readySchedule();

        Map<String, Object> first = autoSchedule(scheduleId);
        Map<String, Object> second = autoSchedule(scheduleId);

        assertThat(assignments(scheduleId)).hasSameSizeAs(list(first, "assignments"));
        assertThat(assignments(scheduleId)).isEqualTo(list(second, "assignments"));
    }

    @Test
    void refusesWithAClearMessageWhenThereIsNothingToSchedule() throws IOException {
        long noStaff = createSchedule();
        uploadSampleTransactions(noStaff);
        assertRefused(noStaff, "staff");

        long noTransactions = createSchedule();
        addStaff(noTransactions, "Anna", 40);
        assertRefused(noTransactions, "transactions");

        long noShifts = readySchedule();
        for (Map<String, Object> shift : client.get().uri("/api/schedules/{id}/shifts", noShifts)
                .retrieve().body(LIST)) {
            client.delete().uri("/api/schedules/{id}/shifts/{shiftId}", noShifts, id(shift))
                    .retrieve().toBodilessEntity();
        }
        assertRefused(noShifts, "shifts");
    }

    @Test
    void unknownScheduleIsNotFound() {
        assertThatThrownBy(() -> autoSchedule(999_999))
                .isInstanceOfSatisfying(RestClientResponseException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
    }

    @Test
    void deletingStaffOrShiftsWithAssignmentsStillWorksAndRemovesTheirRows() throws IOException {
        long scheduleId = readySchedule();
        Map<String, Object> result = autoSchedule(scheduleId);
        long staffId = ((Number) list(result, "assignments").get(0).get("staffId")).longValue();
        long shiftId = ((Number) list(result, "assignments").get(0).get("shiftId")).longValue();

        client.delete().uri("/api/schedules/{id}/staff/{staffId}", scheduleId, staffId).retrieve().toBodilessEntity();
        assertThat(assignments(scheduleId))
                .noneMatch(a -> ((Number) a.get("staffId")).longValue() == staffId);

        client.delete().uri("/api/schedules/{id}/shifts/{shiftId}", scheduleId, shiftId).retrieve().toBodilessEntity();
        assertThat(assignments(scheduleId))
                .noneMatch(a -> ((Number) a.get("shiftId")).longValue() == shiftId);
    }

    private void assertRefused(long scheduleId, String field) {
        assertThatThrownBy(() -> autoSchedule(scheduleId))
                .isInstanceOfSatisfying(RestClientResponseException.class, e -> {
                    assertThat(e.getStatusCode().value()).isEqualTo(422);
                    assertThat(e.getResponseBodyAsString()).contains("\"" + field + "\"");
                });
    }
}
