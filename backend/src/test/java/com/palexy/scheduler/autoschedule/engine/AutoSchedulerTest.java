package com.palexy.scheduler.autoschedule.engine;

import com.palexy.scheduler.transactions.TransactionCell;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AutoSchedulerTest {

    private static final ShiftDef MORNING = new ShiftDef(1, 7, 15);

    private static Draft generate(ScheduleProblem problem) {
        return AutoScheduler.generate(problem, Fixtures.PARAMS);
    }

    private static List<Warning> ofType(Draft draft, WarningType type) {
        return draft.warnings().stream().filter(w -> w.type() == type).toList();
    }

    @Test
    void anHourWithTransactionsButNoShiftIsFlaggedNotFailed() {
        ScheduleProblem problem = new ScheduleProblem(
                List.of(MORNING), Fixtures.team(1, 40), List.of(new TransactionCell(1, 20, 10)));

        Draft draft = generate(problem);

        assertThat(ofType(draft, WarningType.UNCOVERED_HOUR))
                .singleElement()
                .satisfies(w -> {
                    assertThat(w.day()).isEqualTo(1);
                    assertThat(w.hour()).isEqualTo(20);
                });
    }

    @Test
    void shortfallIsCountedAgainstTheFixedNeed() {
        List<TransactionCell> demand = new ArrayList<>();
        for (int hour = 7; hour < 15; hour++) {
            demand.add(new TransactionCell(1, hour, 64));
        }
        ScheduleProblem problem = new ScheduleProblem(List.of(MORNING), Fixtures.team(1, 8), demand);

        Draft draft = generate(problem);

        assertThat(draft.warnings()).anySatisfy(w -> {
            assertThat(w.type()).isEqualTo(WarningType.UNDERSTAFFED);
            assertThat(w.day()).isEqualTo(1);
            assertThat(w.hour()).isEqualTo(9);
            assertThat(w.needed()).isEqualTo(4);
            assertThat(w.scheduled()).isEqualTo(1);
            assertThat(w.message()).isEqualTo("Monday 09:00 needs 4 people, has 1");
        });
        assertThat(draft.warnings()).anySatisfy(w -> {
            assertThat(w.type()).isEqualTo(WarningType.UNDERSTAFFED);
            assertThat(w.day()).isEqualTo(2);
            assertThat(w.needed()).isEqualTo(1);
            assertThat(w.scheduled()).isEqualTo(0);
        });
        assertThat(draft.stats().shortfallStaffHours()).isEqualTo(72);
    }

    @Test
    void aPersonWhoseMaximumIsBelowTheShortestShiftGetsNothingAndIsFlagged() {
        List<StaffDef> staff = List.of(new StaffDef(1, "Anna", 40), new StaffDef(2, "Bo", 4));
        ScheduleProblem problem = new ScheduleProblem(List.of(MORNING), staff, Fixtures.flatDemand(16));

        Draft draft = generate(problem);

        assertThat(ofType(draft, WarningType.UNDER_UTILISED)).singleElement()
                .satisfies(w -> assertThat(w.staffId()).isEqualTo(2L));
        assertThat(draft.stats().staff()).hasSize(2);
        assertThat(draft.stats().staff().get(1).hours()).isEqualTo(0);
        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
    }

    @Test
    void whenNobodyCanWorkAnyShiftTheWarningSaysWhy() {
        ScheduleProblem problem = new ScheduleProblem(
                List.of(MORNING), List.of(new StaffDef(1, "Tiny", 4)), Fixtures.flatDemand(16));

        Draft draft = generate(problem);

        assertThat(draft.placements()).isEmpty();
        assertThat(ofType(draft, WarningType.UNDER_UTILISED)).singleElement().satisfies(w -> {
            assertThat(w.staffId()).isEqualTo(1L);
            assertThat(w.message()).contains("below the shortest shift (8 hours)");
        });
    }

    @Test
    void aDayWithNoTransactionsStillGetsOnePersonPerOpenHour() {
        List<TransactionCell> withoutSunday = Fixtures.sampleDemand().stream().filter(c -> c.day() != 7).toList();
        ScheduleProblem problem = new ScheduleProblem(Fixtures.defaultShifts(), Fixtures.team(8, 40), withoutSunday);

        Draft draft = generate(problem);

        int[][] coverage = ScoreCalculator.coverage(problem, draft.placements());
        for (int hour = 7; hour < 23; hour++) {
            assertThat(coverage[7][hour]).as("Sunday %d:00", hour).isGreaterThanOrEqualTo(1);
        }
    }

    @Test
    void theSameInputGivesTheSameDraft() {
        ScheduleProblem problem = Fixtures.sample(8, 40);

        assertThat(generate(problem)).isEqualTo(generate(problem));
    }

    @Test
    void anEmptyTeamOrNoShiftsReturnsAnEmptyDraftWithoutThrowing() {
        assertThat(generate(Fixtures.sample(0, 40)).placements()).isEmpty();
        ScheduleProblem noShifts = new ScheduleProblem(List.of(), Fixtures.team(3, 40), Fixtures.sampleDemand());
        assertThat(generate(noShifts).placements()).isEmpty();
    }
}
