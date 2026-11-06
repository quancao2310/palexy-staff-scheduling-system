package com.palexy.scheduler.autoschedule.engine;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

/** The scenarios of the design (section 7) on the provided sample week; N = 16. */
class AutoSchedulerAcceptanceTest {

    private static Draft generate(ScheduleProblem problem) {
        return AutoScheduler.generate(problem, Fixtures.PARAMS);
    }

    private static int totalHours(Draft draft) {
        return draft.stats().staff().stream().mapToInt(StaffLoad::hours).sum();
    }

    private static void assertOptimalAndValid(ScheduleProblem problem, Draft draft) {
        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
        assertThat(LocalSearch.findImprovement(problem, Fixtures.PARAMS, draft.placements())).isEmpty();
    }

    @Test
    void typicalTeamCoversEveryOpenHourAndStaffsTheBusyHoursMore() {
        ScheduleProblem problem = Fixtures.sample(8, 40);

        Draft draft = generate(problem);

        assertOptimalAndValid(problem, draft);
        int[][] coverage = ScoreCalculator.coverage(problem, draft.placements());
        for (int day = 1; day <= 7; day++) {
            for (int hour = 7; hour < 23; hour++) {
                assertThat(coverage[day][hour]).as("day %d %d:00", day, hour).isGreaterThanOrEqualTo(1);
            }
        }
        // With 8-hour blocks a shift's headcount follows its average load, so compare whole day-shifts.
        int busiest = 0;
        int quietest = Integer.MAX_VALUE;
        int busiestPeople = 0;
        int quietestPeople = 0;
        for (int day = 1; day <= 7; day++) {
            for (ShiftDef shift : problem.shifts()) {
                int transactions = 0;
                for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
                    transactions += problem.transactions(day, hour);
                }
                int people = coverage[day][shift.startHour()];
                if (transactions > busiest) {
                    busiest = transactions;
                    busiestPeople = people;
                }
                if (transactions < quietest) {
                    quietest = transactions;
                    quietestPeople = people;
                }
            }
        }
        assertThat(busiestPeople).isGreaterThan(quietestPeople);
        List<Double> utilisation = draft.stats().staff().stream().map(StaffLoad::utilisation).toList();
        assertThat(utilisation.stream().max(Double::compare).orElseThrow()
                - utilisation.stream().min(Double::compare).orElseThrow()).isLessThanOrEqualTo(8.0 / 40 + 1e-9); // at most one 8-hour shift apart
        assertThat(generate(problem)).isEqualTo(draft);
    }

    @Test
    void shortTeamStaysWithinItsHoursReportsTheShortfallAndSpendsThemOnBusyHours() {
        ScheduleProblem problem = Fixtures.sample(3, 40);

        Draft draft = generate(problem);

        assertOptimalAndValid(problem, draft);
        assertThat(totalHours(draft)).isLessThanOrEqualTo(120);
        assertThat(draft.stats().shortfallStaffHours()).isGreaterThan(0);
        assertThat(draft.warnings()).anyMatch(w -> w.type() == WarningType.UNDERSTAFFED);
        // A shift's headcount follows its busiest hour, so a second person on a shift needs a busy hour in it.
        draft.placements().stream()
                .collect(java.util.stream.Collectors.groupingBy(p -> p.day() + "/" + p.shiftId()))
                .values().stream().filter(group -> group.size() >= 2).forEach(group -> {
                    Placement first = group.get(0);
                    ShiftDef shift = problem.shift(first.shiftId());
                    int busiest = 0;
                    for (int hour = shift.startHour(); hour < shift.endHour(); hour++) {
                        busiest = Math.max(busiest, Need.of(problem.transactions(first.day(), hour), Fixtures.PARAMS));
                    }
                    assertThat(busiest).as("day %d shift %d", first.day(), first.shiftId()).isGreaterThanOrEqualTo(2);
                });
    }

    @Test
    void bigTeamLeavesNobodyAtZeroAndNeverOverstaffsByMoreThanOne() {
        ScheduleProblem problem = Fixtures.sample(16, 40);

        Draft draft = generate(problem);

        assertOptimalAndValid(problem, draft);
        assertThat(draft.stats().staff()).allMatch(load -> load.hours() > 0);
        // Extra people for fairness never take an hour above need + 1; hours above that come only from shift
        // blocks (a shift's headcount follows its busiest hour), which the headcount plan already contains.
        List<Placement> planned = HeadcountPlanner.plan(problem, Fixtures.PARAMS).stream()
                .map(slot -> new Placement(slot.day(), slot.shift().id(), 1)).toList();
        int[][] plannedCoverage = ScoreCalculator.coverage(problem, planned);
        int[][] coverage = ScoreCalculator.coverage(problem, draft.placements());
        for (int day = 1; day <= 7; day++) {
            for (int hour = 7; hour < 23; hour++) {
                int cap = Math.max(plannedCoverage[day][hour],
                        Need.of(problem.transactions(day, hour), Fixtures.PARAMS) + 1);
                assertThat(coverage[day][hour]).as("day %d %d:00", day, hour).isLessThanOrEqualTo(cap);
            }
        }
        assertThat(draft.stats().idleStaffHours()).isGreaterThan(0);
    }

    @Test
    void addingAMiddayShiftImprovesTheScore() {
        ScheduleProblem withoutMidday = Fixtures.sample(8, 40);
        List<ShiftDef> shifts = new ArrayList<>(Fixtures.defaultShifts());
        shifts.add(new ShiftDef(3, 11, 15));
        ScheduleProblem withMidday = new ScheduleProblem(shifts, Fixtures.team(8, 40), Fixtures.sampleDemand());

        assertThat(generate(withMidday).stats().score()).isGreaterThan(generate(withoutMidday).stats().score());
    }

    @Test
    void hoursNoShiftCoversAreReportedNotFatal() {
        ScheduleProblem problem = new ScheduleProblem(
                List.of(new ShiftDef(1, 7, 15)), Fixtures.team(8, 40), Fixtures.sampleDemand());

        Draft draft = generate(problem);

        assertThat(draft.warnings()).anyMatch(w -> w.type() == WarningType.UNCOVERED_HOUR);
        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
    }

    @Test
    void aPersonCanWorkASplitDayButNeverOverlappingShifts() {
        ScheduleProblem problem = new ScheduleProblem(
                List.of(new ShiftDef(1, 7, 10), new ShiftDef(2, 16, 21)), Fixtures.team(1, 40),
                Fixtures.sampleDemand());

        Draft draft = generate(problem);

        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
        boolean someSplitDay = draft.placements().stream().map(Placement::day).distinct()
                .anyMatch(day -> draft.placements().stream().filter(p -> p.day() == day).count() == 2);
        assertThat(someSplitDay).isTrue();
    }

    @Test
    void aBusyStoreWithManyShiftsAndStaffIsStillScheduledQuickly() {
        List<ShiftDef> shifts = List.of(new ShiftDef(1, 7, 11), new ShiftDef(2, 11, 15), new ShiftDef(3, 15, 19),
                new ShiftDef(4, 19, 23), new ShiftDef(5, 7, 15), new ShiftDef(6, 15, 23));
        List<com.palexy.scheduler.transactions.TransactionCell> busy = Fixtures.sampleDemand().stream()
                .map(c -> new com.palexy.scheduler.transactions.TransactionCell(c.day(), c.hour(),
                        c.transactions() * 8))
                .toList();
        ScheduleProblem problem = new ScheduleProblem(shifts, Fixtures.team(40, 40), busy);

        Draft draft = assertTimeoutPreemptively(Duration.ofSeconds(5), () -> generate(problem));

        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
    }

    @Test
    void aBigTeamIsScheduledQuickly() {
        ScheduleProblem problem = Fixtures.sample(40, 40);

        Draft draft = assertTimeoutPreemptively(Duration.ofSeconds(5), () -> generate(problem));

        assertThat(DraftRules.violations(problem, draft.placements())).isEmpty();
    }
}
